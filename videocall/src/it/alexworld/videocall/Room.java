package it.alexworld.videocall;

import java.util.Random;

import javax.servlet.ServletContext;

import com.google.appengine.api.datastore.DatastoreService;
import com.google.appengine.api.datastore.Entity;
import com.google.appengine.api.datastore.EntityNotFoundException;
import com.google.appengine.api.datastore.KeyFactory;

public class Room {
	
	private String user1;
	private String user2;

	private DatastoreService datastore;
	private Entity entity;
	
	private static final String STRING_USER1="user1";
	private static final String STRING_USER2="user2";
	
	public Room(DatastoreService ds, String key){
		datastore=ds;
		user1=null;
		user2=null;
		entity=new Entity(this.getClass().getSimpleName(), key);
	}
	
	public Room(DatastoreService ds, Entity e){
		datastore=ds;
		user1=(String) e.getProperty(STRING_USER1);
		user2=(String) e.getProperty(STRING_USER2);
		entity=e;
	}
	
	private void updateEntity(){
		if (user1!=null){
			entity.setProperty(STRING_USER1, user1);
		}else{
			entity.removeProperty(STRING_USER1);
		}
		if (user2!=null){
			entity.setProperty(STRING_USER2, user2);
		}else{
			entity.removeProperty(STRING_USER2);
		}
		
	}
	
	private void put(){
		this.updateEntity();
		datastore.put(entity);
	}
	
	private void delete(){
		datastore.delete(entity.getKey());
	}
	
	public int get_occupancy(){
		int occupancy=0;
		if (user1!=null) occupancy+=1;
		if (user2!=null) occupancy+=1;
		return occupancy;
	}
	
	public String[] get_users(){
		return new String[]{user1,user2};
	}
	
	public boolean has_user(String user){
		return user!=null && ((user.equalsIgnoreCase(user1) || user.equalsIgnoreCase(user2)));
	}
	
	public void add_user(String user){
		if (user1==null){
			user1=user;
		}else if (user2==null){
			user2=user;
		}else{
			new Exception("room is full");
		}
		this.put();
	}
	
	public void remove_user(String user){
		if (user==null){
			
		}else if (user.equalsIgnoreCase(user2)){
			user2=null;
		}else if (user.equalsIgnoreCase(user1)){
			if (user2!=null){
				user1=user2;
				user2=null;
			}else{
				user1=null;
			}
		}
		if (this.get_occupancy()>0){
			this.put();
		}else{
			this.delete();
		}
	}
	
	public static Room get_by_key_name(DatastoreService ds,String key){
		Room result=null;
		try {
			result=new Room(ds, ds.get(KeyFactory.createKey(Room.class.getSimpleName(), key)));
		} catch (EntityNotFoundException e) {
			e.printStackTrace();
		}
		return result;
	}
	
	public String getKeyName(){
		return entity!=null?entity.getKey().getName():null;
	}
	
	public String get_other_user(String user){
		String result=null;
		if (user==null){
			
		}else if (user.equalsIgnoreCase(user1)){
			result=user2;
		}else if (user.equalsIgnoreCase(user2)){
			result=user1;
		}
		return result;
	}
	
	public static String make_token(Room room, String user){
		return room.getKeyName() + "/" + user;
	}
	
private static Random random=null;

	
	public static String generate_random(int len){
		if (random==null){
			random=new Random();
		}
		
		long num=0;
		for (int i=0;i<len;i++){
			num*=10;
			num +=random.nextInt(9);
		}
		return Long.toString(num);
	}

	public static String generate_unique_roomkey(ServletContext context,DatastoreService datastore, int len) {
		String key=null;
		while (key==null || get_by_key_name(datastore,key)!=null){
			key=Room.generate_random(len);
		}
		return key;
	}
}
