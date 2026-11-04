# 四六级词表来源

- 上游：https://github.com/KyleBing/english-vocabulary
- 固定提交：`c4c6c80879ff17d7025c28fb853a4991c8e6be6a`
- 获取日期：2026-11-04
- 许可：BSD-3-Clause，见同目录 `LICENSE`；软件内也附带许可证。
- `cet4.txt` 对应上游 `3 四级-乱序.txt`，7508 行、4543 个不区分大小写的词。
- `cet6.txt` 对应上游 `4 六级-乱序.txt`，5651 行、3991 个不区分大小写的词。
- 两表有1873个重合词；合并去重6661词，六级进阶（四级表外）2118词。

这是完整导入所选开源词表，不代表考试官方发布的唯一范围或保证覆盖所有可能考词。六级备考分类包含四级基础，因此有6661词；原始归属保存在每个词条的 `levels` 字段。

在 `companion-desktop` 运行 `python scripts/prepare-exam-vocabulary.py` 可重新生成内置 JSON。脚本合并同词释义，不丢弃词条；输出保留提交号、原文件 SHA-256 和统计。原文件 SHA-256：

- cet4：`b6ef93b392837bfad92467ed6a8b3f22da6caf07fcfe8858c4f9eccb72069835`
- cet6：`4a938c26f5732194330c5453a7fe28d65cf3fd7009fcdfb5bea4517b8ce48ddb`

现有用户学习记录按词合并，不替换用户释义、ID和复习历史。未学习的内置词条无需重复写入浏览器存储，完整备份仍含所有词条。
