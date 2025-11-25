import bcrypt from "bcrypt";
import MongoStore from "connect-mongo";
import express from "express";
import session from "express-session";
import { createServer } from "http";
import { Server } from "socket.io";

import { connectDB } from "./db/connection.js";
import { requireAuth } from "./middleware/auth.js";
import { upload } from "./middleware/upload.js";
import Chat from "./models/Chat.js";
import Product from "./models/Product.js";
import User from "./models/User.js";
import { checkEnv } from "./utils.js";

// Log environment variable
checkEnv();

// Connect to MongoDB
connectDB();

// Create express app
const app = express();
app.use(express.json());

// Session configuration
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: "sessions",
    ttl: 60 * 60 * 24 * 7, // 세션 유효기간: 7일
  }),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 7, // 7일
    httpOnly: true, // XSS 공격 방지
    secure: process.env.NODE_ENV === "production", // HTTPS에서만 전송 (프로덕션)
    sameSite: "lax", // CSRF 공격 방지
  },
});
app.use(sessionMiddleware);

// Socket.IO 설정
const server = createServer(app);
const io = new Server(server);

// Socket.IO에 세션 미들웨어 적용
io.use((socket, next) => {
  sessionMiddleware(socket.request, {}, next);
});

// 정적 파일(이미지) 서빙
app.use("/uploads", express.static(process.env.UPLOAD_PATH));

// 정적 파일(웹) 서빙
app.use("/", express.static(process.env.DIST_PATH));

app.get("/healthz", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/signup", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 이메일 중복 확인
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "이미 사용 중인 이메일입니다",
      });
    }

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 14);

    // 새 사용자 생성
    const user = new User({
      name,
      email,
      password: hashedPassword,
    });
    await user.save();

    // 세션에 사용자 ID 저장(회원가입 후 자동 로그인)
    req.session.userId = user._id;

    res.status(201).json({
      success: true,
      message: "회원가입이 완료되었습니다",
      user: {
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Signup error:", error);

    // Mongoose 유효성 검사 에러 처리
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다",
    });
  }
});

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // 입력 데이터 검증
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "이메일과 비밀번호를 입력해주세요",
      });
    }

    // 사용자 찾기
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다",
      });
    }

    // 비밀번호 확인
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: "이메일 또는 비밀번호가 올바르지 않습니다",
      });
    }

    // 세션에 사용자 ID 저장
    req.session.userId = user._id;

    // 사용자 정보 반환
    res.json({
      success: true,
      message: "로그인 성공",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다",
    });
  }
});

app.post("/api/logout", requireAuth, (req, res) => {
  req.session.destroy((error) => {
    if (error) {
      console.error("Logout error:", error);
      return res.status(500).json({
        success: false,
        message: "로그아웃 중 오류가 발생했습니다",
      });
    }
    res.clearCookie("connect.sid"); // 세션 쿠키 삭제

    res.json({
      success: true,
      message: "로그아웃 성공",
    });
  });
});

app.get("/api/me", requireAuth, async (req, res) => {
  try {
    // 유저 정보 조회
    const user = await User.findById(req.session.userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "사용자를 찾을 수 없습니다",
      });
    }

    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "서버 오류가 발생했습니다",
    });
  }
});

app.post("/api/products", requireAuth, upload.array("images", 10), async (req, res) => {
  try {
    const { title, category, location, price, description } = req.body;

    // 이미지 파일 경로 추출
    const images = req.files ? req.files.map((file) => `/uploads/${file.filename}`) : [];

    // 상품 생성
    const product = new Product({
      title,
      category,
      location,
      price: Number(price),
      description,
      images,
      userId: req.session.userId,
    });
    await product.save();

    res.status(201).json({
      success: true,
      message: "상품이 등록되었습니다",
      product: {
        id: product._id,
        title: product.title,
        price: product.price,
        location: product.location,
        category: product.category,
      },
    });
  } catch (error) {
    console.error("Create product error:", error);

    // Mongoose 유효성 검사 에러 처리
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((err) => err.message);
      return res.status(400).json({
        success: false,
        message: messages.join(", "),
      });
    }

    res.status(500).json({
      success: false,
      message: "상품 등록 중 오류가 발생했습니다",
    });
  }
});

app.get("/api/products", async (req, res) => {
  try {
    // 상품 데이터 조회
    const products = await Product.find().sort({ createdAt: -1 }).lean();

    res.json({
      success: true,
      products: products.map((product) => ({
        id: product._id,
        title: product.title,
        price: product.price,
        location: product.location,
        createdAt: product.createdAt,
        image: product.images?.[0],
        likes: product.likes,
        category: product.category,
      })),
    });
  } catch (error) {
    console.error("Get products error:", error);
    res.status(500).json({
      success: false,
      message: "상품 목록을 가져오는 중 오류가 발생했습니다",
    });
  }
});

app.get("/api/products/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 상품 정보 조회
    const product = await Product.findById(id).populate("userId", "name email").lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "상품을 찾을 수 없습니다",
      });
    }

    res.json({
      success: true,
      product: {
        id: product._id,
        title: product.title,
        price: product.price,
        location: product.location,
        createdAt: product.createdAt,
        images: product.images,
        likes: product.likes,
        category: product.category,
        description: product.description,
        seller: {
          id: product.userId._id,
          name: product.userId.name,
          email: product.userId.email,
        },
      },
    });
  } catch (error) {
    console.error("Get product detail error:", error);
    res.status(500).json({
      success: false,
      message: "상품 정보를 가져오는 중 오류가 발생했습니다",
    });
  }
});

app.get("/api/chats/:productId", requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.userId;

    // 상품 정보 조회
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "상품을 찾을 수 없습니다",
      });
    }

    // 판매자인지 확인
    const isSeller = product.userId.toString() === userId.toString();

    let chat;
    if (isSeller) {
      // 판매자인 경우
      const { buyerId } = req.query;
      chat = await Chat.findOne({
        productId,
        buyerId,
        sellerId: userId,
      })
        .populate("buyerId", "name email")
        .populate("sellerId", "name email");
    } else {
      // 구매자인 경우
      chat = await Chat.findOne({
        productId,
        buyerId: userId,
        sellerId: product.userId,
      })
        .populate("buyerId", "name email")
        .populate("sellerId", "name email");

      // 채팅이 없으면 새로 생성
      if (!chat) {
        chat = new Chat({
          productId,
          buyerId: userId,
          sellerId: product.userId,
          messages: [],
        });
        await chat.save();

        // 생성한 채팅 조회
        chat = await Chat.findById(chat._id)
          .populate("buyerId", "name email")
          .populate("sellerId", "name email");
      }
    }

    if (!chat) {
      return res.json({
        success: true,
        chat: null,
      });
    }

    res.json({
      success: true,
      chat: {
        id: chat._id,
        productId: chat.productId,
        buyer: {
          id: chat.buyerId._id,
          name: chat.buyerId.name,
          email: chat.buyerId.email,
        },
        seller: {
          id: chat.sellerId._id,
          name: chat.sellerId.name,
          email: chat.sellerId.email,
        },
        messages: chat.messages.map((msg) => ({
          id: msg._id,
          senderId: msg.senderId,
          content: msg.content,
          createdAt: msg.createdAt,
        })),
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get chat error:", error);
    res.status(500).json({
      success: false,
      message: "채팅을 불러오는 중 오류가 발생했습니다",
    });
  }
});

// 판매자용 채팅 목록 조회
app.get("/api/products/:productId/chats", requireAuth, async (req, res) => {
  try {
    const { productId } = req.params;
    const userId = req.session.userId;

    // 상품 정보 조회
    const product = await Product.findById(productId);
    if (!product) {
      return res.status(404).json({
        success: false,
        message: "상품을 찾을 수 없습니다",
      });
    }

    // 판매자인지 확인
    const isSeller = product.userId.toString() !== userId.toString();
    if (isSeller) {
      return res.status(403).json({
        success: false,
        message: "권한이 없습니다",
      });
    }

    // 해당 상품의 모든 채팅 목록 조회
    const chats = await Chat.find({
      productId,
      sellerId: userId,
    })
      .populate("buyerId", "name email")
      .sort({ updatedAt: -1 })
      .lean();

    res.json({
      success: true,
      chats: chats.map((chat) => ({
        id: chat._id,
        buyer: {
          id: chat.buyerId._id,
          name: chat.buyerId.name,
          email: chat.buyerId.email,
        },
        lastMessage:
          chat.messages.length > 0 ? chat.messages[chat.messages.length - 1].content : null,
        lastMessageAt:
          chat.messages.length > 0
            ? chat.messages[chat.messages.length - 1].createdAt
            : chat.createdAt,
        messageCount: chat.messages.length,
        updatedAt: chat.updatedAt,
      })),
    });
  } catch (error) {
    console.error("Get product chats error:", error);
    res.status(500).json({
      success: false,
      message: "채팅 목록을 불러오는 중 오류가 발생했습니다",
    });
  }
});

io.on("connection", (socket) => {
  const session = socket.request.session;
  const userId = session?.userId;

  if (!userId) {
    socket.disconnect();
    return;
  }

  console.log(`User connected: ${userId}`);

  // roomId 형식: product-${productId}-buyer-${buyerId}
  socket.on("join-chat", async ({ roomId }) => {
    try {
      // 채팅방 입장
      socket.join(roomId);
      socket.chatRoomId = roomId;

      console.log(`User ${userId} joined room: ${roomId}`);
    } catch (error) {
      console.error("Join chat error:", error);
    }
  });

  // 메시지 전송
  socket.on("send-message", async ({ productId, content, buyerId }) => {
    try {
      if (!content || !content.trim()) return;

      const product = await Product.findById(productId);
      if (!product) return;

      const isSeller = product.userId.toString() === userId.toString();
      let chat;

      if (isSeller) {
        chat = await Chat.findOne({
          productId,
          buyerId,
          sellerId: userId,
        });
      } else {
        chat = await Chat.findOne({
          productId,
          buyerId: userId,
          sellerId: product.userId,
        });
      }

      if (!chat) return;

      // 메시지 추가
      const newMessage = {
        senderId: userId,
        content: content.trim(),
        createdAt: new Date(),
      };
      chat.messages.push(newMessage);
      await chat.save();

      // 메시지 포맷
      const savedMessage = chat.messages[chat.messages.length - 1];
      const messageData = {
        id: savedMessage._id,
        senderId: savedMessage.senderId,
        content: savedMessage.content,
        createdAt: savedMessage.createdAt,
      };

      // 메시지 전송
      const roomId = `product-${productId}-buyer-${chat.buyerId}`;
      io.to(roomId).emit("new-message", messageData);

      console.log(`Message sent in room ${roomId}`);
    } catch (error) {
      console.error("Send message error:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${userId}`);
  });
});

// Start server
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
