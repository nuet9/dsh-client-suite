# 对形与网格检查用法

从技能目录运行示例。图像工具使用 Python 和 Pillow，网格工具使用 Blender 自带的 Python。将文件名和示例坐标换成当前任务的值。分析图和报告写到任务的工作目录。

## 转图和复核主轴

```text
python scripts/align_reference.py photo.jpg display.png --clockwise 0
python scripts/align_reference.py photo.jpg upright.png --axis 20 20 50 60 --axis-check 39 37 --point 80 60
```

在第一张显示副本上取点，第二条命令仍以原图为输入。示例中前两个点定轴，另取的截面中心向轴右侧偏 5 像素。可重复传入 `--axis-check`。如果遮挡或设计弯曲使第三个截面无法可靠确定，在结果中说明可用基准。

JSON 中 `stored_size` 是文件存储画幅，`source_size` 是按 EXIF 方向展开的显示画幅。`forward` 从显示图映射到转正裁图，`inverse` 从裁图返回显示图。两矩阵均以连续像素边界为单位，左上像素中心为 (0.5, 0.5)。`--crop` 在旋转后的画布上给出左、上、右、下边界，右、下边界为开区间。

## 同画幅对照和局部间距

使用相同取景、分辨率、像素宽高比和裁框。模型可输出 RGBA 透明底渲染。不透明渲染可用 `--render-mask` 传入单独的同尺寸遮罩。参考图可用 `--reference-mask` 或在标注里手描几段可靠边缘。`reference_lines` 每段至少含两个点，沿可见边界依次填写。需要表示内孔时可以单独描其边界。遮罩用白前景、黑背景或真实透明通道，工具在 128 处二值化。颜色花纹和高光仍保留作看图背景。

```text
python scripts/compare_contours.py display.png render.png overlay.png --annotations marks.json > deviations.json
```

以下是 120 × 100 示意图的 `marks.json`。同一套显示坐标用于参考和渲染。示例用壳顶与提手下沿的两个点观察竖向净空变化。

```json
{
  "size": [120, 100],
  "reference_lines": [[[20, 75], [70, 75]]],
  "landmarks": [
    {"name": "壳顶", "role": "fit", "reference": [45, 75], "render": [45, 75]},
    {"name": "提手下沿", "role": "check", "reference": [45, 30], "render": [51, 26], "uncertainty_px": 2}
  ],
  "spans": [
    {"name": "竖向间距", "from": "壳顶", "to": "提手下沿", "measure": "reference_axis"}
  ]
}
```

橙色叉号是模型点，青色圆圈是参考点，编号对应报告。此例中模型点向右 6 像素、向上 4 像素，超过示例给定的 2 像素取点误差。沿参考测量方向的间距增大 4 像素。`measure` 设为 `distance` 可比较两个端点的二维直线长度。对斜边、弧边的实际净空，需在同一位置、同一测量方向重新取交点。工具按所给端点计算。省略误差范围时仅报告偏差。

同尺寸图也可能用了不同裁框，叠图前核对裁框记录。随附转图工具会标记原本不透明的照片，后续叠图会忽略旋转留下的透明边角。其他软件导出或再次处理的图片如有透明画框，可传 `--ignore-reference-alpha` 后手描关键边，也可提供明确的物体遮罩。缺少可用参考轮廓时，工具只把模型轮廓叠到参考底图上，报告显示 `reference_contour: none`。这时只能做视觉定位。

## Blender 零件检查

以当前工程真实对象名编写 `parts.json`。可先省略 `--parts` 运行一次，从报告取得对象名。默认值 `review` 会保留尚未分类的零件。

```json
{
  "default": "review",
  "objects": {
    "Speaker shell": "solid",
    "Single-sided trim": "sheet",
    "Studio floor": "skip"
  }
}
```

```text
blender -b --factory-startup --disable-autoexec speaker.blend --python-exit-code 1 -P scripts/check_mesh.py -- --parts parts.json --output mesh-report.json
```

使用现场已核验的 Blender 可执行文件。脚本读取当前帧、当前视图层中可求值为网格的 Mesh、Curve、Surface 和 Font，包含视口中生效的修改器。若有集合实例、未实现的几何节点实例、仅在渲染时生效的修改器或视口以外的交付场景，另查对应几何。工程依赖必须运行的自定义驱动时，记录只读检查的求值限制。

| 状态或字段 | 如何使用 |
|---|---|
| `issues` | 查对应零件和计数。实体开放边、超过两面共享的边、相邻面绕序冲突和近零面积面各有独立字段。 |
| `sheet` | 允许设计边界，仍会报告开放边数。核对这些边是否只出现在预期位置。 |
| `shell_signed_volumes` | 对封闭且局部绕序一致的网格分壳计算。单个实体壳整体反向会被指出。多个嵌套壳的负体积可能代表内腔，应结合造型判断。镜像对象变换单列。 |
| `near_zero_faces` | 面积阈值是零件包围盒对角线平方乘以 `--relative-area`，默认 1e-14。特别细小的设计面需结合比例复核。设为 0 只查计算面积为零的面。 |
| `review` / `skipped` | 分别表示待判定与主动排除。两者都单独计数。 |
| `ok` | 指此分类下所查的网格项目通过。局部阴影、自交、接触关系、参考相似度和编辑手感仍由对应视图或编辑试验确认。 |

程序成功写出 JSON 后即可读各零件的状态。退出码反映脚本是否正常执行。修订模型后用新文件名保存报告，比较相同对象的计数和同视角画面。
