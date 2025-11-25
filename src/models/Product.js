import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "상품명을 입력해주세요"],
      trim: true,
      minlength: [2, "상품명은 최소 2자 이상이어야 합니다"],
    },
    category: {
      type: String,
      required: [true, "카테고리를 선택해주세요"],
      enum: {
        values: ["electronics", "fashion", "furniture", "books", "sports", "beauty", "kids", "etc"],
        message: "올바른 카테고리를 선택해주세요",
      },
    },
    location: {
      type: String,
      required: [true, "위치를 입력해주세요"],
      trim: true,
    },
    price: {
      type: Number,
      required: [true, "가격을 입력해주세요"],
      min: [0, "가격은 0원 이상이어야 합니다"],
    },
    description: {
      type: String,
      required: [true, "상품 설명을 입력해주세요"],
      trim: true,
      minlength: [10, "상품 설명은 최소 10자 이상이어야 합니다"],
    },
    images: {
      type: [String],
      default: [],
      validate: {
        validator: function (array) {
          return array.length <= 10;
        },
        message: "이미지는 최대 10장까지 등록할 수 있습니다",
      },
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "판매자 정보가 필요합니다"],
    },
    likes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Product = mongoose.model("Product", productSchema);

export default Product;
