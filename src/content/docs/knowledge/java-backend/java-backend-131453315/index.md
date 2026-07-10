---
title: "SpringSecurity(四):开发认证总结案例(传统Web)"
description: "这是一个WEB的案例，我写的思路就是，你从上倒下复制粘贴，这个案例可以跑起来，方便后面学知识的时候用。由于视频文档这部分没有显示，所以看这篇会省很多时间。"
sourceId: "131453315"
source: "https://blog.csdn.net/qq_45852626/article/details/131453315"
sourceSeries: []
category: java-backend
tags:
  - "Spring"
status: draft
difficulty: intermediate
contentType: practice
sidebar:
  order: 131453315
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/131453315)（历史文章导入，当前状态为草稿）

#### 传统Web开发认证总结案例
### 前言

这是一个WEB的案例，我写的思路就是，你从上倒下复制粘贴，这个案例可以跑起来，方便后面学知识的时候用。由于视频文档这部分没有显示，所以看这篇会省很多时间。

### POM.xml部分

注意我的数据库版本是8.0，如果你是8以下的版本，可以看视频里怎么处理的，或者看我上一篇文章的内容。

```
  <dependencies>
        <dependency>
            <groupId>com.alibaba</groupId>
            <artifactId>druid</artifactId>
            <version>1.1.16</version>
        </dependency>
        <dependency>
            <groupId>mysql</groupId>
            <artifactId>mysql-connector-java</artifactId>
            <version>8.0.18</version>
        </dependency>
        <dependency>
            <groupId>org.mybatis.spring.boot</groupId>
            <artifactId>mybatis-spring-boot-starter</artifactId>
            <version>2.2.0</version>
        </dependency>
        <dependency>
            <groupId>org.thymeleaf.extras</groupId>
            <artifactId>thymeleaf-extras-springsecurity5</artifactId>
            <version>3.0.5.RELEASE</version>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-security</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-thymeleaf</artifactId>
        </dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-web</artifactId>
        </dependency>
        <dependency>
            <groupId>org.thymeleaf.extras</groupId>
            <artifactId>thymeleaf-extras-springsecurity5</artifactId>
        </dependency>

        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-test</artifactId>
            <scope>test</scope>
        </dependency>
        <dependency>
            <groupId>org.springframework.security</groupId>
            <artifactId>spring-security-test</artifactId>
            <scope>test</scope>
        </dependency>
    </dependencies>


```

### properties部分

```
server.port= 9091

# 关闭thymeleaf 缓存
spring.thymeleaf.cache= false

# 配置数据源
spring.datasource.type= com.alibaba.druid.pool.DruidDataSource
spring.datasource.driver-class-name= com.mysql.cj.jdbc.Driver
spring.datasource.url= jdbc:mysql://localhost:3306/security?characterEncoding=UTF-8&useSSL=false&&serverTimezone=CST
spring.datasource.username= 你的账号
spring.datasource.password= 你的 密码

# Mybatis配置
# 注意mapper目录必须用"/"
mybatis.mapper-locations= classpath:com/wang/mapper/*.xml
mybatis.type-aliases-package=com.example.eneity

# 日志处理
logging.level.com.example = debug


```

### 实体类entity

* Role

```
public class Role {
    private Integer id;
    private String name;
    private String nameZh;


    public Integer getId() {
        return id;
    }

    public void setId(Integer id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getNameZh() {
        return nameZh;
    }

    public void setNameZh(String nameZh) {
        this.nameZh = nameZh;
    }
}


```

* User

```
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.*;


public class User implements UserDetails {
        private Integer id;
        private String username;
        private String password;
        private Boolean enabled;
        private Boolean accountNonExpired;
        private Boolean accountNonLocked;
        private Boolean credentialsNonExpired;
        private List<Role> roles = new ArrayList();
        @Override
        public Collection<? extends GrantedAuthority> getAuthorities() {

           Set<GrantedAuthority> authorities = new HashSet();
            roles.forEach(role->{
                SimpleGrantedAuthority simpleGrantedAuthority = new SimpleGrantedAuthority(role.getName());
                authorities.add(simpleGrantedAuthority);
            });
            return authorities;
        }
        @Override
        public String getPassword() {
            return password;
        }
        @Override
        public String getUsername() {
            return username;
        }
        @Override
        public boolean isAccountNonExpired() {
            return accountNonExpired;
        }
        @Override
        public boolean isAccountNonLocked() {
            return accountNonLocked;
        }
        @Override
        public boolean isCredentialsNonExpired() {
            return credentialsNonExpired;
        }
        @Override
        public boolean isEnabled() {
            return enabled;
        }

    public void setRoles(List<Role> roles) {
        this.roles = roles;
    }

    public Integer getId() {
        return id;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Boolean getEnabled() {
        return enabled;
    }

    public void setEnabled(Boolean enabled) {
        this.enabled = enabled;
    }

    public Boolean getAccountNonExpired() {
        return accountNonExpired;
    }

    public void setAccountNonExpired(Boolean accountNonExpired) {
        this.accountNonExpired = accountNonExpired;
    }

    public Boolean getAccountNonLocked() {
        return accountNonLocked;
    }

    public void setAccountNonLocked(Boolean accountNonLocked) {
        this.accountNonLocked = accountNonLocked;
    }

    public Boolean getCredentialsNonExpired() {
        return credentialsNonExpired;
    }

    public void setCredentialsNonExpired(Boolean credentialsNonExpired) {
        this.credentialsNonExpired = credentialsNonExpired;
    }

    public List<Role> getRoles() {
        return roles;
    }
}


```

### Dao层

```
import com.wang.entity.Role;
import com.wang.entity.User;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface UserDao {
    //提供根据用户名返回方法
    User loadUserByUsername(String username);

    //提供根据用户id查询用户角色信息方法
    List<Role> getRoleByUid(Integer id);
}


```

### resources层

#### mapper层

##### UserDaoMapper

```
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE mapper
        PUBLIC "-//mybatis.org//DTD Mapper 3.0//EN"
        "http://mybatis.org/dtd/mybatis-3-mapper.dtd">
<mapper namespace="com.wang.dao.UserDao">

    <!--        更具用户名查询用户方法-->
    <select id="loadUserByUsername" resultType="com.wang.entity.User">
        select id,
               username,
               password,
               enabled,
               accountNonExpired,
               accountNonLocked,
               credentialsNonExpired
        from user
        where username = #{username}
    </select>
    <!--        查询指定⾏数据-->
    <select id="getRoleByUid" resultType="com.wang.entity.Role">
        select r.id,
               r.name,
               r.name_zh nameZh
        from role r,
             user_role ur
        where r.id = ur.rid
          and ur.uid = #{uid}
    </select>
</mapper>


```

#### templates层

##### index.html

```
<!DOCTYPE html>
<html lang="en" xmlns:th="http://www.thymeleaf.org" xmlns:sec="http://www.thymeleaf.org/extras/spring-security" >
<head>
    <meta charset="UTF-8">
    <title>Title</title>
</head>
<body>
<h1>欢迎来到我的系统</h1>
<ul>
    <li sec:authentication="principal.username"></li>
    <li sec:authentication="principal.authorities"></li>
    <li sec:authentication="principal.accountNonExpired"></li>
    <li sec:authentication="principal.accountNonLocked"></li>
    <li sec:authentication="principal.credentialsNonExpired"></li>
</ul>

<a th:href="@{/logout}">退出系统</a>
</body>
</html>


```

##### login.html

```
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Title</title>
</head>
<body>
<h1>User Login</h1>

<h2>
  <div th:text="${SPRING_SECURITY_LAST_EXCEPTION}"></div>
</h2>
<form method="post" th:action="@{/doLogin}">
  UserName：<input name="uname" type="text"><br>
  PassWord：<input name="passwd" type="text"><br>
  <input type="submit" value="Login">
</form>
<div th:text="${session.SPRING_SECURITY_LAST_EXCEPTION}"></div>
</body>
</html>


```

### service层

```
import com.wang.dao.UserDao;
import com.wang.entity.Role;
import com.wang.entity.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import java.util.List;
@Service
public class MyUserDetailService implements UserDetailsService {

    private final UserDao userDao;

    @Autowired
    public MyUserDetailService(UserDao userDao){
        this.userDao = userDao;
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        //1. 查询用户
        User user = userDao.loadUserByUsername(username);
        if (ObjectUtils.isEmpty(user)) {
            throw new UsernameNotFoundException("用户名不正确");
        }
        //2. 查询权限信息
        List<Role> roles = userDao.getRoleByUid(user.getId());
        user.setRoles(roles);
        return user;
    }
}


```

### Controller层

```
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class TestController {

    @RequestMapping("/user")
    public String user(){
        //1. 代码中获取用户信息
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        //2.通过获取用户信息
        User user =(User) authentication.getPrincipal();
        System.out.println("username="+user.getUsername());
        System.out.println("authorities="+ user.getAuthorities());
        return "user OK";
    }
}


```

### Config层

#### MvcConfigure

```
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.ViewControllerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
@Configuration
public class MvcConfigure implements WebMvcConfigurer {
    @Override
    public void addViewControllers(ViewControllerRegistry registry){
        registry.addViewController("/login.html").setViewName("login");
        registry.addViewController("/index.html").setViewName("index");
    }
}


```

#### SecuritConfigure

```
import com.wang.service.MyUserDetailService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.authentication.builders.AuthenticationManagerBuilder;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.WebSecurityConfigurerAdapter;

@Configuration
public class SecurityConfigure extends WebSecurityConfigurerAdapter {

    @Autowired
    private MyUserDetailService myUserDetailService;


//    @Bean
//    public UserDetailsService userDetailsService(){
//        InMemoryUserDetailsManager inMemoryUserDetailsManager = new InMemoryUserDetailsManager();
//        inMemoryUserDetailsManager.createUser(User.withUsername("root").password("{noop}123").roles("admin").build());
//        return inMemoryUserDetailsManager;
//    }

    @Override
    protected void configure(AuthenticationManagerBuilder auth) throws Exception{
        auth.userDetailsService(myUserDetailService);
    }

    protected void configure(HttpSecurity http) throws Exception {
        http.authorizeRequests()
                .mvcMatchers("/login.html").permitAll()
                .anyRequest().authenticated()
                .and()
                .formLogin()
                .loginPage("/login.html") //指定自定义登陆页面
                .loginProcessingUrl("/doLogin")
                .usernameParameter("uname")
                .passwordParameter("passwd")
                .defaultSuccessUrl("/index.html",true)
                .failureUrl("/login.html") //重定向到登陆页面
                .and()
                .logout()
                .logoutUrl("/logout")
                .logoutSuccessUrl("/logout.html")
                .and()
                .csrf().disable();

    }
}


```

### 结尾

请确保所有内容都贴上去后，再运行程序，数据库相关的配置记得修改为自己的内容
