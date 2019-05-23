package it.alexworld.videocall;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.util.logging.Logger;

import javax.servlet.ServletException;
import javax.servlet.ServletOutputStream;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.appengine.api.channel.ChannelMessage;
import com.google.appengine.api.channel.ChannelServiceFactory;
import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;

public class MessagePage extends HttpServlet {
	
	private static final Logger logging = Logger.getLogger(MessagePage.class.getName());
	
	@Override
	protected void doPost(HttpServletRequest req, HttpServletResponse resp)
			throws ServletException, IOException {
		
		String room_key=req.getParameter("r");
		
		String message=readBody(req.getInputStream());
		logging.info("RCVD MSG: "+message);
		
		DatastoreService datastore=DatastoreServiceFactory.getDatastoreService();
		Room room = Room.get_by_key_name(datastore, room_key);
		if (room!=null){
			String user=req.getParameter("u");
			String other_user=room.get_other_user(user);
			if (other_user!=null){
				ChannelServiceFactory.getChannelService().sendMessage(new ChannelMessage(Room.make_token(room, other_user), message));
				logging.info("Delivered message to user "+other_user);
			}else{
				ServletOutputStream out=resp.getOutputStream();
				out.println("ERROR: No such user on the other side");
				out.flush();
				out.close();
				logging.severe("ERROR: No such user on the other side");
			}
		}else{
			logging.severe("Unknown room "+room_key);
		}
		
	}
	
	private String readBody(InputStream is){
		String result=null;
		if (is!=null){
			try {
				BufferedReader buffRead=new BufferedReader(new InputStreamReader(is));
				String line=null;
				result="";
				while((line=buffRead.readLine())!=null){
					result+=line+"\n";
				}
			} catch (IOException e) {
				// TODO Auto-generated catch block
				logging.severe(e.getMessage());
				e.printStackTrace();
			}
		}
		return result;
	}
	
	
	
}
