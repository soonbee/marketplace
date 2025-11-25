export function checkEnv() {
  console.log("ENV:");
  console.log(`   NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`   PORT: ${process.env.PORT}`);
  console.log(`   MONGODB_URI: ${maskMongoUri(process.env.MONGODB_URI)}`);
  console.log(`   SESSION_SECRET: ${maskValue(process.env.SESSION_SECRET)}`);
  console.log(`   UPLOAD_PATH: ${process.env.UPLOAD_PATH}`);
  console.log(`   DIST_PATH: ${process.env.DIST_PATH}`);
  console.log("");
}

function maskValue(value) {
  if (!value) return;
  if (value.length <= 4) return "****";
  return value.substring(0, 4) + "****";
}

function maskMongoUri(uri) {
  if (!uri) return;

  const match = uri.match(/^(mongodb(?:\+srv)?:\/\/)([^:]+):([^@]+)@(.+)$/);
  if (match) {
    const [, protocol, username, , rest] = match;
    return `${protocol}${username}:****@${rest}`;
  }

  return uri;
}
