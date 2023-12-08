---
title: Pika 编程规范
author: --
date: '2023-11-10'
---
- 1 C++ 函数变量或者类成员，基本类型变量比如 bool、char、整型(int/unsigned etc)、浮点数(float/double)、指针(不包括 const 类型指针)，在声明时就进行零值初始化 [fix: init every class member's value to defeat the redis-cli connection closed by pika #1390](https://github.com/OpenAtomFoundation/pika/pull/1390)
- 2 尽量使用智能指针如 share\_ptr、scope\_ptr、unique\_ptr，不要使用 New/Delete [Fix: memory leak when RedisSets destructs Qihoo360/blackwidow#14](https://github.com/Qihoo360/blackwidow/pull/14) ；尽量使用 Pika 中封装的 Defer，防止 变量/文件 资源泄露
- 3 获取指针后，首先判断其是否为 nullptr，不要在判空前使用[fix: access null pointer #1426](https://github.com/OpenAtomFoundation/pika/pull/1426) 或者判空后还要接着使用[fix: access null pointer #1414](https://github.com/OpenAtomFoundation/pika/pull/1414)
- 4 每次提交代码前，在代码根目录通过命令 `find . -iname *.h | xargs clang-format -i` 与 `"find . -iname *.cc | xargs clang-format -i"`把代码格式化下
- 5 继承不要超过两层
- 6 不要使用可重入锁（递归锁）
- 7 命名风格
    - class 命名使用名词，大写开头；
    - class member 使用名词，小写，下划线式风格，最后字符保持为下划线；
    - class function 命名为 Verb + Noun，不要取名如 “KeyDelete” 这种二把刀式的命名，如果 func 为 public 则首字母大写，否则小写；
    - function var 命名使用名词，小写，下划线式风格，最后字符不得为下划线；
- 8 使用 auto 时，如果右值是 指针 或者 引用 形式，务必使用 “auto &” 形式，防止产生值赋值导致无法正确修改右值的引用，例子[the right way to use 'auto' keyword](https://github.com/OpenAtomFoundation/pika/issues/1727) 。
- 9 大家提交代码的时候规范下 commit message，遵循结构化语义化，也便于自动化生成 changelog 等，参考 [https://www.conventionalcommits.org/en/v1.0.0/](https://www.conventionalcommits.org/en/v1.0.0/) 。issue 和 pr title 也尽量参考上面这个规范。最重要一条：commit message 尽量使用英文，别中文，至少保证 issue 和 pr title 是英文。
- 10 在 C++11 中已经引入 make\_tuple 方便构建多返回值，pika 中以后存在多返回值时，使用 make\_tuple 构建，编程示例：

```c
      #include <iostream>  
      #include <tuple>
      std::tuple<int, std::string, double> make_tuple_example() {  
          int a = 1;  
          std::string b = "hello";  
          double c = 3.14;  
          return std::make_tuple(a, b, c);  
      }
      int main() {  
          std::tuple<int, std::string, double> t = make_tuple_example();  
          int x = std::get<0>(t);    // 获取 t 中的第一个元素，即 a  
          std::string y = std::get<1>(t);    // 获取 t 中的第二个元素，即 b  
          double z = std::get<2>(t);    // 获取 t 中的第三个元素，即 c
          std::cout << "x = " << x << std::endl;  
          std::cout << "y = " << y << std::endl;  
          std::cout << "z = " << z << std::endl;
      
         // OR 
      
          auto xx, yy, zz = make_tuple_example();
          std::cout << "x = " << xx << std::endl;
          std::cout << "y = " << yy << std::endl;
          std::cout << "z = " << zz << std::endl;
      
          return 0;  
      }
```