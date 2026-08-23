# Spring demo

One small application reproduces three supported error families:

```sh
mvn spring-boot:run -Dspring-boot.run.profiles=mybatis
mvn spring-boot:run -Dspring-boot.run.profiles=redis
mvn spring-boot:run -Dspring-boot.run.profiles=npe
```

Run the same commands through `loghud_run` for incremental HUD updates. On Windows PowerShell, quote the Maven property if the shell requires it.

The sibling `fixtures/` directory provides dependency-free logs for tests and UI demonstrations when Java or Maven is unavailable.
