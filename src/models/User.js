import bcrypt from "bcrypt";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "이름을 입력해주세요"],
      trim: true,
      minlength: [2, "이름은 최소 2자 이상이어야 합니다"],
    },
    email: {
      type: String,
      required: [true, "이메일을 입력해주세요"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "올바른 이메일 형식이 아닙니다"],
    },
    password: {
      type: String,
      required: [true, "비밀번호를 입력해주세요"],
      minlength: [6, "비밀번호는 최소 6자 이상이어야 합니다"],
    },
  },
  {
    timestamps: true,
  }
);

// // 비밀번호 해싱 미들웨어
// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) {
//     return next();
//   }

//   try {
//     this.password = await bcrypt.hash(this.password, 14);
//     next();
//   } catch (error) {
//     next(error);
//   }
// });

// // 비밀번호 비교 메서드
// userSchema.methods.comparePassword = async function (candidatePassword) {
//   return await bcrypt.compare(candidatePassword, this.password);
// };

// JSON 응답에서 비밀번호 제외
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

const User = mongoose.model("User", userSchema);

export default User;
