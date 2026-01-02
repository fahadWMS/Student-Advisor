import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  matcher: [
    "/chat/:path*",
    "/history/:path*",
    "/documents/:path*",
    "/profile/:path*",
  ]
}
