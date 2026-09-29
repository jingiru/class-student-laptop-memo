const os = require("node:os");
const { createClassroomServer } = require("./create-server");

const port = Number(process.env.PORT || 3001);
const host = process.env.HOST || "0.0.0.0";
const { httpServer } = createClassroomServer();

function localAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((item) => item && item.family === "IPv4" && !item.internal)
    .map((item) => item.address);
}

httpServer.listen(port, host, () => {
  console.log("\nClassroom Guide 교사 서버가 시작되었습니다.");
  console.log(`교사 화면: http://localhost:${port}`);
  for (const address of localAddresses()) {
    console.log(`학생 서버 주소: http://${address}:${port}`);
  }
  console.log("종료하려면 Ctrl+C를 누르세요.\n");
});

function shutdown() {
  httpServer.close(() => process.exit(0));
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
