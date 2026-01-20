import Link from "next/link";

export const dynamic = "force-dynamic";

type Role =
  | "SuperAdmin"
  | "FullAdmin"
  | "Admin"
  | "RegionalManager"
  | "GeneralManager"
  | "ProgramDirector"
  | "Instructor"
  | "Examiner"
  | "Student";

const ROLES: Role[] = [
  "SuperAdmin",
  "FullAdmin",
  "Admin",
  "RegionalManager",
  "GeneralManager",
  "ProgramDirector",
  "Instructor",
  "Examiner",
  "Student",
];

export default function AssignRolePage() {
  return (
    <main style={{ maxWidth: 720, margin: "40px auto", padding: 16, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700 }}>Assign Role (Admin)</h1>
      <p style={{ marginTop: 8, lineHeight: 1.4 }}>
         This page assigns a role inside your default tenant. For now it’s a simple tool for you
        (SuperAdmin) to bootstrap staff/student access.
      </p>

      <form action="/api/admin/assign-role" method="post" style={{ marginTop: 24 }}>
        <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>User email</label>
        <input
          name="email"
          type="email"
          required
          placeholder="name@company.com"
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        />

        <label style={{ display: "block", marginTop: 16, marginBottom: 6, fontWeight: 600 }}>
          Role
        </label>
        <select
          name="role"
          required
          defaultValue="Instructor"
          style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ccc" }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>

        <button
          type="submit"
          style={{
            marginTop: 18,
            padding: "10px 14px",
            borderRadius: 10,
            border: 0,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Assign Role
        </button>
      </form>

      <p style={{ marginTop: 18 }}>
        <Link href="/">Back</Link>
      </p>
    </main>
  );
}
