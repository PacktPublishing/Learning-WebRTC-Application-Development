package it.alexworld.videocall;

import java.io.ByteArrayOutputStream;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.util.logging.Logger;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.appengine.api.channel.ChannelServiceFactory;
import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;

public class MainServlet extends HttpServlet {

	private static final Logger logging = Logger.getLogger(MainServlet.class.getName());
	
	@Override
	protected void doGet(HttpServletRequest req, HttpServletResponse resp)
			throws ServletException, IOException {
		// Renders the main page. When this page is shown, we create a new
	    //	channel to push asynchronous updates to the client.
		
		logging.warning("Request startpage, serving it..");

		String room_key = sanitize(req.getParameter("r"));
		
		
		DatastoreService datastore=DatastoreServiceFactory.getDatastoreService();
		if (room_key == null){
			String redirect;
			
			//generate random unique key
			room_key=Room.generate_unique_roomkey(getServletContext(),datastore,8);

			redirect=getBaseUrl(req)+"?r="+room_key;
			
			resp.sendRedirect(redirect);
			logging.info("Redirecting visitor to base URL to "+redirect);
			return;
		}
		
		String user=null;
		int initiator = 0;
		
		Room room = Room.get_by_key_name(datastore, room_key);
		System.out.println("Room: "+(room!=null?room.getKeyName():"null"));
		
		if (room==null){
			// new room
			user=Room.generate_random(8);
			room = new Room(datastore,room_key); 
			
			room.add_user(user);
			initiator=0;
		}else if (room!=null && room.get_occupancy() == 1){
			// 1 occupant
			user = Room.generate_random(8);
			room.add_user(user);
			
			initiator=1;	
		} else{
			// 2 occupants (full)
			
			
			//TODO
			
			logging.info("User " + user + " added to room " + room_key);
			logging.info("Room " + room_key + " has state " + room.toString());
			resp.sendError(400);
			logging.severe("Error 4xx: Room is full!");
			return;
		}
		
		String room_link= getBaseUrl(req)+"?r="+room_key;
		String token = ChannelServiceFactory.getChannelService().createChannel(room_key+"/"+user);
		String pc_config = make_pc_config(null,null,null);
		String indexhtml=(readFile("template.html")); // 0.html
		
		
		// no templates support for Java :-( it seems..
		indexhtml=indexhtml.replaceAll("\\{\\{token\\}\\}", token);
		indexhtml=indexhtml.replaceAll("\\{\\{me\\}\\}", user);
		indexhtml=indexhtml.replaceAll("\\{\\{room_key\\}\\}", room_key);
		indexhtml=indexhtml.replaceAll("\\{\\{room_link\\}\\}", room_link);
		indexhtml=indexhtml.replaceAll("\\{\\{initiator\\}\\}", String.valueOf(initiator));
		indexhtml=indexhtml.replaceAll("\\{\\{pc_config\\}\\}", pc_config);
		resp.getOutputStream().print(indexhtml);
		
		logging.info("User " + user + " added to room " + room_key);
	    logging.info("Room " + room_key + " has state " + room.toString());
	    
		
	}
	
	public static String getBaseUrl(HttpServletRequest req){
		String result=null;
		if (req.getServerPort()==443){
			result="https://"+req.getServerName()+"/";
		}else{
			result="http://"+req.getServerName()+":"+req.getServerPort()+"/";
		}
		return result;
	}
	
	public static String readFile(String path){
		String result=null;
		try {
			FileInputStream fis=new FileInputStream(path);
			ByteArrayOutputStream baos=new ByteArrayOutputStream();
			byte[] buffer=new byte[8192*4];
			int letti;
			
			while ( (letti=fis.read(buffer))>0 ){
				baos.write(buffer, 0, letti);
			}
			fis.close();
			
			return baos.toString();
		} catch (FileNotFoundException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		} catch (IOException e) {
			// TODO Auto-generated catch block
			e.printStackTrace();
		}
		return result;
	}
	
	public static String sanitize(String key){
		if (key!=null && key.length()>=30) key=key.substring(0, 30);
		String res=key!=null?key.replace("[^a-zA-Z0-9\\-]", "-"):null;
		return res;
	}
	
	public static String make_pc_config(String[] stun_servers, String[] turn_servers, String[] turn_credentials){
		String iceServers="{ \"iceServers\": [{ \"urls\": [";
		if (stun_servers!=null){
			for (int i=0; i<stun_servers.length; i++){
				if (stun_servers[i]!=null && !stun_servers[i].equalsIgnoreCase("")){
					iceServers= "\"stun:"+stun_servers[i]+"\",";
				}
			}
		}
		iceServers+="\"stun:stun.l.google.com:19302\"] }";
		if (turn_servers!=null && turn_credentials!=null && turn_credentials.length==2){
			iceServers+=",{\"urls\":[";
			for (int i=0; i<turn_servers.length; i++){
				if (turn_servers[i]!=null && !turn_servers[i].equalsIgnoreCase("")){
					iceServers= "\"turn:"+turn_servers[i]+"\",";
				}
			}
			iceServers+="],\"credential\":\""+turn_credentials[0]+"\",\"username\":\""+turn_credentials[1]+"\"}";
		}
		iceServers+="]}";
		
		
		return iceServers;
	}
	
}
