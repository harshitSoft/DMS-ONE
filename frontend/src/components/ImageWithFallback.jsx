import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { fileUrl } from "../api/client";

export default function ImageWithFallback({ src, alt = "", className = "h-16 w-16 rounded-md object-cover", fallbackClassName = "h-16 w-16 rounded-md" }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  if (!src || failed) return <div className={`grid place-items-center bg-slate-100 text-slate-400 ${fallbackClassName}`} role="img" aria-label={`${alt || "Image"} unavailable`}><ImageOff size={20} /></div>;
  return <img src={fileUrl(src)} alt={alt} className={className} onError={() => setFailed(true)} loading="lazy" />;
}
