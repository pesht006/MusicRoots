import { useState } from "react";

// Shows the artist photo when available, otherwise a colored initials tile.
// Falls back to initials if the image fails to load (broken/blocked URL).
export default function Avatar({
  name,
  image,
  size = 44,
  rounded = 14,
}: {
  name: string;
  image?: string;
  size?: number;
  rounded?: number;
}) {
  const [failed, setFailed] = useState(false);
  const showImg = image && !failed;

  if (showImg) {
    return (
      <img
        className="avatar-img"
        src={image}
        alt={name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        style={{ width: size, height: size, borderRadius: rounded }}
      />
    );
  }
  return (
    <div
      className="avatar-fallback"
      style={{ width: size, height: size, borderRadius: rounded, fontSize: size * 0.42 }}
      aria-label={name}
    >
      {name.trim()[0]?.toUpperCase() || "?"}
    </div>
  );
}
