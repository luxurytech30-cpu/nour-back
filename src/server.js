const app = require("./app");
const { connectDB } = require("./config/db");

const port = process.env.PORT || 5000;

(async () => {
  await connectDB(process.env.MONGO_URI);
  app.listen(port, () => console.log(`Server running on ${port}`));
})();