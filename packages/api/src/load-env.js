import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Load `packages/api/.env` before `config/env.js` reads `process.env`. */
dotenv.config({ path: path.resolve(__dirname, "../.env") });
