import { redirect } from "next/navigation";

/**
 * Lead lists used to be its own screen. Managing files and browsing the leads inside
 * them are the same job, so it now lives on the customers page — this only exists so
 * old links and bookmarks land somewhere sensible.
 */
export default function ListsMoved() {
  redirect("/admin/customers");
}
