export const fixtures = {
  redis: `org.springframework.data.redis.RedisConnectionFailureException: Unable to connect to Redis\n\tat com.example.Cache.get(Cache.java:42)\nCaused by: io.lettuce.core.RedisConnectionException: Unable to connect to localhost:6379\nCaused by: java.net.ConnectException: Connection refused\n`,
  mybatis: `org.apache.ibatis.binding.BindingException: Invalid bound statement (not found): com.example.UserMapper.findById\n\tat org.apache.ibatis.binding.MapperMethod.execute(MapperMethod.java:80)\n`,
  bean: `org.springframework.beans.factory.UnsatisfiedDependencyException: Error creating bean with name 'controller'\nCaused by: org.springframework.beans.factory.BeanCreationException: Error creating bean with name 'service'\nCaused by: java.lang.IllegalStateException: missing configuration\n\tat com.example.AppConfig.service(AppConfig.java:31)\n`,
  npe: `java.lang.NullPointerException: Cannot invoke "User.getName()" because "user" is null\n\tat com.example.UserService.load(UserService.java:27)\n`,
  port: `***************************\nAPPLICATION FAILED TO START\n***************************\nDescription:\nWeb server failed to start. Port 8080 was already in use.\nAction:\nStop the process using port 8080.\n`,
  mysql: `java.sql.SQLSyntaxErrorException: You have an error in your SQL syntax\n\tat com.mysql.cj.jdbc.StatementImpl.execute(StatementImpl.java:55)\n`,
  mvc: `org.springframework.web.bind.MissingServletRequestParameterException: Required request parameter 'id' is not present\n\tat org.springframework.web.method.HandlerMethod.handle(HandlerMethod.java:12)\n`,
}
