package dev.loghud;

import org.apache.ibatis.binding.BindingException;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.Bean;
import org.springframework.core.env.Environment;
import org.springframework.data.redis.RedisConnectionFailureException;

@SpringBootApplication
public class DemoApplication {
  public static void main(String[] args) { SpringApplication.run(DemoApplication.class, args); }

  @Bean CommandLineRunner fail(Environment environment) {
    return args -> {
      if (environment.matchesProfiles("mybatis")) throw new BindingException("Invalid bound statement (not found): dev.loghud.UserMapper.findById");
      if (environment.matchesProfiles("redis")) throw new RedisConnectionFailureException("Unable to connect to localhost:6379");
      if (environment.matchesProfiles("npe")) { Object user = null; user.toString(); }
    };
  }
}
