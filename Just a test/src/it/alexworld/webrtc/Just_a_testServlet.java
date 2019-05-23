package it.alexworld.webrtc;
import java.io.IOException;
import java.util.Date;

import javax.servlet.http.*;

@SuppressWarnings("serial")
public class Just_a_testServlet extends HttpServlet {
	public void doGet(HttpServletRequest req, HttpServletResponse resp) throws IOException {
		resp.setContentType("text/plain");
		resp.getWriter().println("Hi Alessandro, thanks for coming!\nDate & Time: "+new Date().toString());
	}
}
