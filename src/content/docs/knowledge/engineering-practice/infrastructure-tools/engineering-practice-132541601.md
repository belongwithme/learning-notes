---
title: "MinIO框架安装使用+实现上传需求"
description: "MinIO对象存储系统是为海量数据存储、人工智能、大数据分析而设计，基于Apache License v2.0开源协议的对象存储系统，它完全兼容Amazon S3接口，单个对象最大可达5TB，适合存储海量图片、视频、日志文件、备份数据和容器/虚拟机镜像等。"
sourceId: "132541601"
source: "https://blog.csdn.net/qq_45852626/article/details/132541601"
sourceSeries: []
category: engineering-practice
subcategory: infrastructure-tools
tags:
  - "工程实践"
status: draft
difficulty: beginner
contentType: practice
sidebar:
  order: 132541601
---


> 原文：[CSDN](https://blog.csdn.net/qq_45852626/article/details/132541601)（历史文章导入，当前状态为草稿）

## 什么是MinIO框架

**前置知识：对象存储**

```
对象存储服务（ Object Storage Service，OSS ）:
是一种海量、安全、低成本、高可靠的云存储服务，适合存放任意类型的文件。
容量和处理能力弹性扩展，多种存储类型供选择，全面优化存储成本。


```

MinIO对象存储系统是为海量数据存储、人工智能、大数据分析而设计，基于`Apache License v2.0`开源协议的对象存储系统，它完全兼容`Amazon S3`接口，单个对象最大可达5TB，适合存储海量图片、视频、日志文件、备份数据和容器/虚拟机镜像等。

通常在企业中我们会将一些图片，视频，文档等相关数据存储在对象存储中，常见的对象存储服务有阿里云的OSS对象存储、FastDFS分布式文件系统以及公司的私有云平台等等，以便于数据的存储和快速获取。但随着业务的快速发展，我们需要存储一些身份信息用于审核和实名相关的数据，这部分数据较为敏感，因此对于敏感数据的存储也可以选择Minio来进行自建服务。

## 如何安装（Docker版）

MinIO安装非常的简单，在网上你很少会看到有关于MinIo的安装问题，所以基本上你去搜一下就能很容易成功安装，在这里我采用的是Docker去安装它。  
 但是Docker中会有一些坑在，我基本上凭实力全踩上一遍，所以你跟着我去安装，基本不会出什么问题 。

### 安装步骤

#### 1. 查询MinIO的服务版本

```
docker search minio


```

#### 2. 拉取MinIO

```
docker pull minio/minio
下载稳定版本的镜像
下载后使用docker images查看下载的镜像


```

操作如下图所示  
 ![在这里插入图片描述](./assets/132541601/e891f4fd54e6864def59b267.png)

#### 3.启动

**注意端口要起两个（一个9090，一个9000）！！！查了2个小时！！！**  
 下面的代码不能完全套用，关于用户名，密码，数据卷的绑定记得

```
docker run -d -p 9000:9000 -p 9090:9090 --name=minio --restart=always -e "MINIO_ROOT_USER=xxx" -e "MINIO_ROOT_PASSWORD=xxx" -v /home/data:/data -v /home/config:/root/.minio  minio/minio server /data --console-address ":9000" --address ":9090"


```

##### 报错在docker中没有操作文件的权限

```
docker: Error response from daemon: Mounts denied: 
The path /home/data is not shared from the host and is not known to Docker.
You can configure shared paths from Docker -> Preferences... -> Resources -> File Sharing.
See https://docs.docker.com/desktop/mac for more info.


```

解决:

1. 打开Docker客户端的首选项（Preference）
2. 找到 Resources下的 FILE SHARING
3. 配置你允许让Docker访问使用的目录

![在这里插入图片描述](./assets/132541601/7d4ae0bdbb633e454681b74e.png)  
 然后就大功告成!!!  
 ![在这里插入图片描述](./assets/132541601/382809883b316f50913c9f6a.png)

#### 4. 访问

注意我们访问的地址为：http://127.0.0.1:9090  
 然后输入用户名和密码就可以登录进去了。

## 简单配置

### 1.找到创建用户界面

在导航栏中找到identity/user处创建一个用户，点击create user按钮  
 ![在这里插入图片描述](./assets/132541601/d93f168be220f844dae8147e.png)

### 2. 设置用户信息

用户名密码以及权限写完之后，就可以使用该用户登录MinIO控制台了。  
 ![在这里插入图片描述](./assets/132541601/9819b1f42a8b155827bb7625.png)  
 创建用户之后，点击用户弹出用户的基本信息，点击导航栏中的`Service Accounts`，出现下面的界面

![在这里插入图片描述](./assets/132541601/70323cd6dfc435f47513a792.png)  
 点击右边的`Create Access Key`，系统会随机生成`Create Access Key`，点击create按钮后，会展示出它们的信息，**这时记得将它们复制粘贴到你的笔记或者存储文件中，后续使用代码上传文件时需要用到这两个key。**  
 ![在这里插入图片描述](./assets/132541601/4326414ee2bd0ebfe04e0d64.png)

### 3. 创建一个桶

在页面导航栏中找到`Administrator/Buckets`，点击右上角创建桶按钮  
 ![在这里插入图片描述](./assets/132541601/fca32570ed148c0e12fc0139.png)  
 然后输入桶的名字，就大功告成了！  
 ![在这里插入图片描述](./assets/132541601/726bc5db499bceac6fb77bd0.png)

## 使用MinIO

### 依赖搭建

```
 <!-- minio依赖-->
    <dependency>
      <groupId>io.minio</groupId>
      <artifactId>minio</artifactId>
      <version>8.3.3</version>
    </dependency>
    <!-- 官方 miniodemo需要的依赖-->
    <dependency>
      <groupId>me.tongfei</groupId>
      <artifactId>progressbar</artifactId>
      <version>0.7.4</version>
    </dependency>
     <!-- 这个依赖最好是在4.8.1以上，就用下面这个一般不出什么问题-->
    <dependency>
      <groupId>com.squareup.okhttp3</groupId>
      <artifactId>okhttp</artifactId>
      <version>4.9.2</version>
    </dependency>


```

### MinIO的初始化

```
MinioClient minioClient =
    MinioClient.builder()
        .endpoint("https://play.min.io")
        .credentials("Q3AM3UQ867SPQQA43P2F", "zuf+tfteSlswRu7BJ86wekitnifILbZam1KYY3TG")
        .build();


```

* builder：用于构建一个Minio客户端的配置对象
* endpoint：指定Minio服务的URL地址和端口号
* credentials：提供认证凭证，这里使用的是用户名（admin）和密码（xxx）
* build：客户端的创建  
   我们获取到的了MinIOClient对象，就可以进行MinIo的API操作。

### API

#### 存储桶的基本操作

##### 1. 检查桶是否存在

* boolean bucketExists(BucketExistsArgs args)：检查存储桶是否存在（注意里面的参数还需要创建）  
   代码如下：

```
    public final static String endPoint = "xxx";
    public final static String accessKey = "xxxx";
    public final static String secretKey = "xxxx";
    public final static String BucketName = "xxxx";
 public static void uploadFile() throws  InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException  {
        try {
            // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
            MinioClient minoClient = MinioClient.builder()
                    .endpoint(endPoint)
                    .credentials(accessKey,secretKey)
                    .build();

            // 存储桶的基本使用,新版需要使用build来构造BucketExistsArgs对象
            BucketExistsArgs existsArgs = BucketExistsArgs.builder()
                    .bucket(BucketName)
                    .build();
            boolean existBucketFlag = minoClient.bucketExists(existsArgs);

            System.out.println("桶是否存在："+existBucketFlag);
              } catch (MinioException e) {
            System.out.println("Error occurred: " + e);
        }
    }


```

##### 2. 创建存储桶

* public void makeBucket(MakeBucketArgs args）：创建一个启用给定区域和对象锁定功能的存储桶。  
   代码如下：

```
   public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey,secretKey)
                .build();
        // 创建存储桶
        String bucketName="wang";
        //存储桶不存在则创建  if(!minoClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build())){
            MakeBucketArgs makeBucketArgs = MakeBucketArgs.builder().bucket(bucketName).build();
            minoClient.makeBucket(makeBucketArgs);
            System.out.println("创建存储桶成功"+bucketName);
        }else{
            System.out.println("已存在");
        }
    }
}


```

结果如下：  
 ![在这里插入图片描述](./assets/132541601/d8f52b6d1cf4ea654792834f.png)

##### 3. 查询所有桶的列表信息

* public List listBuckets()：列出所有桶的桶信息  
   代码如下：

```
 public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey,secretKey)
                .build();

        List<Bucket> buckets = minoClient.listBuckets();
        buckets.forEach(bucket -> {
            System.out.println("存储桶名称："+bucket.name()+"存储时间"+bucket.creationDate());
   });
 }


```

注意：桶的创建时间默认是美国时间，创建桶时我们可以指定桶的时区或者设置 MinIO服务器时区。  
 结果如下：  
 ![在这里插入图片描述](./assets/132541601/e55ffee33e4eddc675fc2e32.png)

##### 4. 删除存储桶

* public void removeBucket(RemoveBucketArgs args)：删除一个空桶  
   **注意，如果存储桶不是空桶，删除会报错**  
   代码如下：

```
    public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey,secretKey)
                .build();
        String bucketName = "wang";
        RemoveBucketArgs bucketArgs=RemoveBucketArgs.builder().bucket(bucketName).build();
        if(minoClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build())) {
            minoClient.removeBucket(bucketArgs);
            System.out.println("删除存储桶成功！"+bucketName);
        }else {
            System.out.println("存储桶不存在，无法删除");
        }
    }


```

#### 对象的基本操作

##### 上传对象

###### PutObject方法

* public ObjectWriteResponse putObject(PutObjectArgs args)：将给定的流上传为存储桶的对象  
   InputStream上传：

```
    public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey,secretKey)
                .build();
        String bucketName= "testdemo";
        //创建InputStream上传
        File file = new File("D:\\testUploadFile\\test1.webp");
        InputStream inputStream = new FileInputStream(file);
        long start = System.currentTimeMillis();
        //上传流
        minoClient.putObject(
                PutObjectArgs.builder().
                        bucket(bucketName)
                        .object("one/"+file.getName())
                        .stream(inputStream,inputStream.available(),-1)
                  .build());
        inputStream.close();
        long over = System.currentTimeMillis();
        System.out.println("uploaded successfully 耗时："+(over-start));
    }


```

结果如下：  
 ![在这里插入图片描述](./assets/132541601/65a2678e273bc71ad9d831c7.png)  
 **需要注意几个点：**

* 添加的Object大小不能超过 5GB。
* 默认情况下，如果已存在同名Object且对该Object有访问权限，则新添加的Object将覆盖原有的Object，并返回 200 OK。
* OSS没有文件夹的概念，所有资源都是以文件来存储，但您可以通过创建一个以正斜线（/）结尾，大小为 0的Object来创建模拟文件夹（指定 /后，默认会自动创建）。
* 上传文件是也可以使用SSE-C加密，添加自定义元数据及消息头等操作。

##### 获取对象

###### getObject方法

* public GetObjectResponse getObject(GetObjectArgs args)：获取对象的数据  
   代码如下：

```
    public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey, secretKey)
                .build();
        String bucketName = "testdemo";
        GetObjectArgs getObjectArgs = GetObjectArgs.builder()
                .bucket(bucketName)
                .object("one/test1.webp")
                .build();
        GetObjectResponse objectResponse = minoClient.getObject(getObjectArgs);
        System.out.println(objectResponse.bucket());
        System.out.println(objectResponse);
    }


```

结果如下：  
 ![在这里插入图片描述](./assets/132541601/908a52f32c1d3905d11fb171.png)

###### downloadObject方法

* public void downloadObject(downloadObjectArgs args)：将对象的数据下载到磁盘。

```
        //将对象数据下载到磁盘
        DownloadObjectArgs objectArgs = DownloadObjectArgs.builder()
                .bucket(bucketName)
                .object("one/test1.webp")
                .filename("D:\\testUploadFile\\download\\test1.webp")
                .build();
        minoClient.downloadObject(objectArgs);


```

结果  
 ![在这里插入图片描述](./assets/132541601/f33726d0cabd621b0b69b30c.png)

###### getPresignedObjectUrl方法

* public String getPresignedObjectUrl(GetPresignedObjectUrlArgs args)：获取HTTP方法，到期时间和自定义请求参数的对象的预签名URL。  
   这个方法的用途在于：  
   可以提供给不用登录进行图片浏览，第三方共享访问等。  
   我们还可以对返回 URL，根据业务做一些参数验签等控制。  
   代码如下：

```
    public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey, secretKey)
                .build();

        String bucketName = "testdemo";
        GetPresignedObjectUrlArgs urlArgs = GetPresignedObjectUrlArgs.builder()
                .bucket(bucketName)
                .object("one/test1.webp")
                .method(Method.GET)
                .expiry(120, TimeUnit.SECONDS)
                .build();
        String presignedObjectUrl = minoClient.getPresignedObjectUrl(urlArgs);
        System.out.println(presignedObjectUrl);
    }


```

结果如下  
 `http://127.0.0.1:9090/testdemo/one/test1.webp?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=wang%2F20230829%2Fus-east-1%2Fs3%2Faws4_request&X-Amz-Date=20230829T032634Z&X-Amz-Expires=120&X-Amz-SignedHeaders=host&X-Amz-Signature=aa1bbaac4906eeac505cd2602954973ab99189f4674570f078f412b6e7dc7109`   
 返回带签名的URL有点小长，过期之后访问会报错。

###### getPresignedPostFormData方法

* public Map<String,String> getPresignedPostFormData(PostPolicy policy)：获取对的PostPolicy的表单数据以使用POST方法上传其数据。
* 使用此方法，获取对象的上传策略（包含签名、文件信息、路径等），然后使用这些信息采用 POST 方法的表单数据上传数据。也就是可以生成一个临时上传的信息对象，第三方可以使用这些信息，就可以上传文件。  
   注意：第三方请求中的签名必须和 创建策略中的签名参数等一致，不符合策略要求的就会上传失败。  
   **一般使用场景：**

1. 第三方请求应用服务器接口，来获取一个上传策略信息
2. 第三方使用 Http+访问策略信息直接请求应用服务器接口进行上传文件。

代码如下：

```
public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey, secretKey)
                .build();

        String bucketName = "testdemo";
        String objectName = "one/test2.webp";
        //1.为存储桶创建一个上传策略，过期时间为7天
        PostPolicy policy = new PostPolicy(bucketName, ZonedDateTime.now().plusDays(7));
        //设置一个参数key-value，值为上传对象的名称（保留为桶中的名字）
        policy.addEqualsCondition("key",objectName);
        //添加 Content-Type以”image/“开头，表示只能上传照片
        policy.addStartsWithCondition("Content-Type","image/");
        //设置上传文件的大小 10 KiB to 10MiB
        policy.addContentLengthRangeCondition(10*1024,10*1024*1024);

        //2. 获取策略的认证令牌，签名等信息
        Map<String, String> formData = minoClient.getPresignedPostFormData(policy);

        //3. 模拟第三方，使用OkHttp调用Post上传对象
        //创建MultipartBody对象
        MultipartBody.Builder multipartBuilder = new MultipartBody.Builder();
        multipartBuilder.setType(MultipartBody.FORM);
        for (Map.Entry<String,String> entry : formData.entrySet()){
            multipartBuilder.addFormDataPart(entry.getKey(),entry.getValue());
        }

        multipartBuilder.addFormDataPart("key",objectName);
        multipartBuilder.addFormDataPart("Content-Type","image/webp");
        //todo
       File uploadFile =new File("D:\\testUploadFile\\test2.webp");
       multipartBuilder.addFormDataPart("file",objectName, RequestBody.create(uploadFile,null));
       Request request =
               new Request.Builder()
                       .url(endPoint+bucketName)
                       .post(multipartBuilder.build())
                       .build();
        OkHttpClient httpClient = new OkHttpClient().newBuilder().build();
        Response response = httpClient.newCall(request).execute();
        if(response.isSuccessful()){
            System.out.println("successfully");
        }else{
            System.out.println("error");
        }
    }


```

结果：  
 ![在这里插入图片描述](./assets/132541601/335dbccd3f03a81248d43516.png)

##### 复制对象

###### copyObject方法

* public ObjectWriteResponse copyObject(CopyObjectArgs args)：通过服务器端从另一个对象复制数据来创建一个对象。  
   代码如下：

```
  public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey, secretKey)
                .build();
        String bucketName = "testdemo";
        String bucketName2 = "hao";
        CopyObjectArgs objectArgs = CopyObjectArgs.builder()
                .source(CopySource.builder()
                        .bucket(bucketName)
                        .object("one/test2.webp")
                        .build())
                .bucket(bucketName2)
                .object("two/test1.webp")
                .build();
        minoClient.copyObject(objectArgs);
    }


```

结果如下：  
 ![在这里插入图片描述](./assets/132541601/f7dd809db7d7bd7f12dc130c.png)

##### 删除对象

###### removeObject方法

* public void removeObject(RemoveObjectArgs args)：移除一个对象。  
   代码如下：

```
    public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey, secretKey)
                .build();
        RemoveObjectArgs objectArgs = RemoveObjectArgs.builder()
                .bucket(BucketName)
                .object("one/test2.webp")
                .build();
        minoClient.removeObject(objectArgs);
    }


```

结果如下：  
 ![在这里插入图片描述](./assets/132541601/aea136d38065c96545bc87e0.png)

###### removeObjects方法

* public Iterable removeObjects(RemoveObjectsArgs args)：懒惰地删除多个对象。它需要迭代返回的 Iterable 以执行删除。  
   代码如下：

```
        //构建需要删除的对象
        List<DeleteObject> objects = new LinkedList<>();
        objects.add(new DeleteObject("2023/07/05/1189f7file01.jfif"));
        objects.add(new DeleteObject("onetest1.webp"));
        objects.add(new DeleteObject("onetest3.webp"));
        RemoveObjectsArgs objectsArgs = RemoveObjectsArgs.builder()
                .bucket(BucketName)
                .objects(objects)
                .build();
        Iterable<Result<DeleteError>> results = minoClient.removeObjects(objectsArgs);


```

结果如下：  
 ![在这里插入图片描述](./assets/132541601/bf146950e558ce57ec19c374.png)

##### 桶对象的信息查询

###### 查询桶下对象

* public Iterable listObjects(ListObjectsArgs args)：列出桶的对象信息。  
   代码如下：

```
  public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey, secretKey)
                .build();
        ListObjectsArgs listObjectsArgs = ListObjectsArgs.builder()
                .bucket(BucketName)
                .build();
        Iterable<Result<Item>> results = minoClient.listObjects(listObjectsArgs);
        for (Result<Item> result : results) {
            Item item = result.get();
       System.out.println(item.objectName()+"\t"+item.size());
        }
    }


```

结果如下：  
 ![在这里插入图片描述](./assets/132541601/146b415cde58f567aa5baa8b.png)

###### 递归查询桶下对象

代码如下：

```
  public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey, secretKey)
                .build();
        ListObjectsArgs listObjectsArgs = ListObjectsArgs.builder()
                .bucket(BucketName)
                .recursive(true)
                .build();
        Iterable<Result<Item>> results = minoClient.listObjects(listObjectsArgs);

        for (Result<Item> result : results) {
            Item item = result.get();
            System.out.println(item.objectName()+"\t"+item.size());
        }
    }


```

结果如下：  
 ![在这里插入图片描述](./assets/132541601/966174f694c34436083cce58.png)

###### 条件查询

代码如下：

```
 public static void uploadFile() throws InsufficientDataException, ErrorResponseException, IOException, NoSuchAlgorithmException, InvalidKeyException, InvalidResponseException, XmlParserException, InternalException, ServerException {
        // 使用MinIO服务的URL，端口，Access key和Secret key创建一个MinioClient对象
        MinioClient minoClient = MinioClient.builder()
                .endpoint(endPoint)
                .credentials(accessKey, secretKey)
                .build();
        ListObjectsArgs listObjectsArgs = ListObjectsArgs.builder()
                .bucket(BucketName)
                .startAfter("VipSongsDownload/陶喆 - 爱是个什么东西.mflac")
                .maxKeys(10)
                .recursive(true)
                .build();
        Iterable<Result<Item>> results = minoClient.listObjects(listObjectsArgs);

        for (Result<Item> result : results) {
            Item item = result.get();
            System.out.println(item.objectName()+"\t"+item.size());
        }
    }


```

![在这里插入图片描述](./assets/132541601/4eceafa6232fa156a6bd05f2.png)

## 总结

这里列举了一些基本的用法，后面需求方面的慢慢更
