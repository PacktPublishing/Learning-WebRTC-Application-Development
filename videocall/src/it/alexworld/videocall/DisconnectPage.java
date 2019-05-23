package it.alexworld.videocall;

import java.io.IOException;
import java.util.logging.Logger;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import com.google.appengine.api.channel.ChannelMessage;
import com.google.appengine.api.channel.ChannelPresence;
import com.google.appengine.api.channel.ChannelService;
import com.google.appengine.api.channel.ChannelServiceFactory;
import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.DatastoreServiceFactory;

public class DisconnectPage extends HttpServlet {

	private static final Logger logging = Logger.getLogger(DisconnectPage.class.getName());
	
	@Override
	protected void doPost(HttpServletRequest req, HttpServletResponse resp)
			throws ServletException, IOException {
		logging.info("Received channel disconnect!");		
		ChannelService channelService = ChannelServiceFactory.getChannelService();
		ChannelPresence presence = channelService.parsePresence(req);
		
		logging.info("Client ID: "+presence.clientId());
		
		String key = presence.clientId();
		if (key!=null){
			String[] splitted=key.split("/");
			if (splitted.length==2){
				String room_key=splitted[0];
				String user=splitted[1];
				logging.info("Removing user " + user + " from room " + room_key);
				DatastoreService datastore=DatastoreServiceFactory.getDatastoreService();
				Room room = Room.get_by_key_name(datastore,room_key);
				if (room!=null && room.has_user(user)){
					String other_user=room.get_other_user(user);
					room.remove_user(user);
					logging.info("Room " + room_key + " has state " + room.toString());
					if (other_user!=null){
						ChannelServiceFactory.getChannelService().sendMessage(new ChannelMessage(Room.make_token(room, other_user), "{\"type\":\"bye\"}"));
						logging.info("Sent BYE to " + other_user);
					}
				}else{
					logging.warning("Unknown room " + room_key);
				}
			}
		}
		
	}
	
}
