import Link from "next/link";

export const metadata = {
  title: "Page Not Found | Pep Nation Lab",
};

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--black, #050A0F)",
        padding: "2rem",
      }}
    >
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background:
            "radial-gradient(ellipse at 50% 0%, rgba(0,196,188,0.06) 0%, transparent 60%)",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 520,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontSize: "5rem",
            fontWeight: 800,
            color: "var(--teal, #00C4BC)",
            lineHeight: 1,
            marginBottom: "1rem",
            letterSpacing: "-0.04em",
          }}
        >
          404
        </div>
        <h1
          style={{
            fontSize: "1.6rem",
            color: "var(--white, #FFFFFF)",
            marginBottom: "0.75rem",
            fontWeight: 700,
          }}
        >
          Page Not Found
        </h1>
        <p
          style={{
            fontSize: "0.95rem",
            color: "var(--silver, #A8B4C0)",
            marginBottom: "2rem",
            lineHeight: 1.6,
          }}
        >
          The Page You Are Looking For Does Not Exist Or Has Been Moved.
        </p>
        <Link
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0.75rem 1.5rem",
            background: "var(--teal, #00C4BC)",
            color: "var(--black, #050A0F)",
            borderRadius: "0.5rem",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Return To Login
        </Link>
      </div>
    </div>
  );
}
