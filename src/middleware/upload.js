import fs from "fs";
import multer from "multer";
import path from "path";

const uploadDir = process.env.UPLOAD_PATH;

// uploads 디렉토리 생성
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 스토리지 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // 고유한 파일명 생성 (타임스탬프 + 랜덤 문자열 + 원본 확장자)
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${ext}`);
  },
});

// 파일 필터 (이미지만 허용)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error("이미지 파일만 업로드 가능합니다 (jpg, jpeg, png, gif, webp)"), false);
  }
};

// 파일 제한 설정
const limits = {
  fileSize: 10 * 1024 * 1024, // 파일 크기 10MB 제한
  files: 10, // 최대 10개 파일
};

// multer 설정
export const upload = multer({
  storage,
  fileFilter,
  limits,
});
