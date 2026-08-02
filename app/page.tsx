import { ChessStudio } from "../components/chess-studio";
import { getChatGPTUser } from "./chatgpt-auth";

export default async function Home() {
  const viewer = await getChatGPTUser();
  return <ChessStudio viewer={viewer ? { displayName: viewer.displayName, email: viewer.email } : null} />;
}
