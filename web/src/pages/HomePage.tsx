import { useAuth } from "../hooks/useAuth";

export function HomePage() {
  const user = useAuth();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">こんにちは, {user?.displayName ?? ""}</h1>
      <p className="text-neutral-400 mt-2">これから機能を実装していきます。</p>
    </div>
  );
}
