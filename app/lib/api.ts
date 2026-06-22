const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

interface LoginPayload {
  email: string;
  password: string;
}

interface LoginResponse {
  token: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}

export async function loginRequest(payload: LoginPayload): Promise<LoginResponse> {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const error = await res
      .json()
      .catch(() => ({ message: "Error al iniciar sesión" }));
    throw new Error(error.message || "Error al iniciar sesión");
  }

  return res.json();
}