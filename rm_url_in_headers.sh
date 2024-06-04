#!/bin/bash

# 递归遍历目录并处理markdown文件
process_directory() {
    local directory="$1"
    # 查找目录中的所有markdown文件
    find "$directory" -type f -name "*.md" | while read -r file; do
        process_markdown_file "$file"
    done
}

# 处理单个markdown文件
process_markdown_file() {
    local file="$1"
    # 临时文件
    local temp_file=$(mktemp)

    # 读取文件并处理
    while IFS= read -r line; do
        if [[ "$line" =~ ^#+\  ]]; then
            # 删除header行中的URL
            echo "$line" | sed -E 's/\[.*?\]\(https?:\/\/.*?\)//g' >> "$temp_file"
        else
            echo "$line" >> "$temp_file"
        fi
    done < "$file"

    # 用处理后的内容替换原文件
    mv "$temp_file" "$file"
}

# 主程序
docs_directory="docs"
process_directory "$docs_directory"