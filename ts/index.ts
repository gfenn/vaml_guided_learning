
let RUNS_PER_GROUP = 3
let DATA_COMPRESSION_LINES = 1000
let DATA_COMPRESSION_SHAPE = 1000
let DATA_COMPRESSION_PREDICTIONS = 10000
let EWMA_BETA_LINES = 0.03
let EWMA_BETA_SHAPE = 0.03

let NUM_ACTIONS = 40
let THROTTLE_ACTIONS = 8
let STEER_ACTIONS = 5

let GROUP_COLORS: {[key: string]: string} = {
    'blocks': 'red',
    'deeplab': 'lightgreen'
}

let FORMAL_NAME: {[key: string]: string} = {
    'blocks': 'Blocks',
    'deeplab': 'Deeplab'
}





// =============================================
// =============================================
// =============================================
// =========== DATA FIELDS =====================
// =============================================
// =============================================
// =============================================

function normalizeValues(values: number[]) {
  // Adjust min so lowest value is 0
  let minVal = values.reduce((min, val) => val < min ? val : min, values[0])
  values = values.map(val => val - minVal)

  // Divice each by max value so range is 0-1
  let maxVal = values.reduce((max, val) => val > max ? val : max, values[0])
  values = values.map(val => val / maxVal)
  return values
}

class DataFieldI {
  group: string
  field: string
  constructor(group: string, field: string) {
    this.group = group
    this.field = field
  }
}

class DataField extends DataFieldI {
  points: Point[]
  constructor(group: string, field: string, points: Point[]) {
    super(group, field)
    this.points = points
  }

  applyEwma(beta: number) {
    let ewma = this.points[0].y
    this.points.forEach(function(point: Point) {
        ewma = point.y * beta + ewma * (1 - beta)
        point.y = ewma
    })
  }
}

class DataRunField extends DataField {
  run_id: number
  constructor(group: string, run_id: number, field: string, points: Point[]) {
    super(group, field, points)
    this.run_id = run_id
  }
}

class DataGroupRunFields extends DataFieldI {
    runs: DataRunField[]
    constructor(runs: DataRunField[]) {
      super(runs[0].group, runs[0].field)
      this.runs = runs
    }

    applyEwma(beta: number) {
      for (let run in this.runs) { this.runs[run].applyEwma(beta) }
    }
}

class DataMultipleGroupRunFields {
  groups: {[key: string]: DataGroupRunFields} = {}
  add(group: DataGroupRunFields) {
    this.groups[group.group] = group
    return this
  }

  applyEwma(beta: number) {
    for (let key in this.groups) { this.groups[key].applyEwma(beta) }
  }
}

class DataGroupMetrics extends DataFieldI {
  p25: DataField
  p50: DataField
  p75: DataField
  constructor(group: string, metrics: any) {
    super(group, 'metrics')
    this.p25 = new DataField(group, 'p25', metrics['p25'])
    this.p50 = new DataField(group, 'p50', metrics['p50'])
    this.p75 = new DataField(group, 'p75', metrics['p75'])
  }

  applyEwma(beta: number) {
    this.p25.applyEwma(beta)
    this.p50.applyEwma(beta)
    this.p75.applyEwma(beta)
  }

  midlineShape(): Point[] {
    let points: Point[] = []
    points.push(...this.p25.points)
    points.push(...this.p75.points.reverse())
    return points
  }
}

class PredictionSampleStepData {
  data: number[]
  dataNormalized: number[]
  totalDELETE: number
  constructor(data: number[], totalDELETE: number) {
    this.data = data
    this.dataNormalized = normalizeValues(data)
    this.totalDELETE = totalDELETE
  }
  get total() {
    let total = this.data.reduce((p, c) => p + c, this.data[0])
    return total / this.data.length
  }
  get totalNormalize() {
    let total = this.dataNormalized.reduce((p, c) => p + c, this.dataNormalized[0])
    return total / this.dataNormalized.length
  }
}

class PredictionSampleRowData {
  sample: string
  run: number
  steps: PredictionSampleStepData[]
  constructor(sample: string, run: number, steps: PredictionSampleStepData[]) {
    this.sample = sample
    this.run = run
    this.steps = steps
  }
}

class PredictionSampleData {
  sample: string
  rows: PredictionSampleRowData[]
  constructor(sample: string, rows: PredictionSampleRowData[]) {
    this.sample = sample
    this.rows = rows
  }
}

class DataCollector {

  private _arrayToPoints(values: number[], compression: number): Point[] {
    let points: Point[] = []
    values.forEach((value, index) =>
      points.push(new Point((index + 1) * compression, value)))
    return points
  }

  async getRunField(group: string, run: number, compression: number, field: string): Promise<DataRunField> {
    let atp = this._arrayToPoints
    return fetch('data/run_field?group=' + group
                 + '&run=' + run
                 + '&compression=' + compression
                 + '&field=' + field)
        .then(response => response.json() )
        .then(function(values) {
          return atp(values, compression)
        })
        .then(function(points) {
          return new DataRunField(group, run, field, points)
        })
  }

  async getAllRunFields(group: string, compression: number, field: string): Promise<DataGroupRunFields> {
    let promises = []
    for (let run_id = 1; run_id <= RUNS_PER_GROUP; run_id++) {
      promises.push(this.getRunField(group, run_id, compression, field))
    }
    return Promise.all(promises)
      .then(function(all_runs: DataRunField[]) {
        return new DataGroupRunFields(all_runs)
      })
  }

  async getAllGroupsField(groups: string[], compression: number, field: string): Promise<DataMultipleGroupRunFields> {
    let promises = []
    for (let group_id in groups) {
      let group = groups[group_id]
      promises.push(this.getAllRunFields(group, compression, field))
    }
    return Promise.all(promises)
      .then(function(groups: DataGroupRunFields[]) {
        let allGroups = new DataMultipleGroupRunFields()
        for (let key in groups) {
          allGroups.add(groups[key])
        }
        return allGroups
      })
  }

  async getGroupMetrics(group: string, compression: number): Promise<DataGroupMetrics> {
    let atp = this._arrayToPoints
    return fetch('data/group_metrics?group=' + group
                 + '&compression=' + compression)
        .then(function(response) { return response.json(); })
        .then(function(metrics) {
          let data: any = {}
          for (let key in metrics) {
            data[key] = atp(metrics[key], compression)
          }
          return data
        })
        .then(function(metrics) {
          return new DataGroupMetrics(group, metrics)
        })
  }

  async getAllSamples(): Promise<string[]> {
    return Promise.resolve(["blocks", "deeplab", "nodsf", "linear"])
    // return fetch('data/all_samples')
    //     .then(function(response) { return response.json(); })
  }

  // TODO - needs to eventually be something where you pass in specific runs
  async getSamplePredictionsForRun(group: string, run_id: number, sample: string, compression: number): Promise<PredictionSampleRowData> {
      return this.getRunField(group, run_id, compression, 'rewards')
        .then(data => {
          let values = normalizeValues(data.points.map(p => p.y))
          let steps = values.map(v => {
            let mockData: number[] = []
            for (let idx = 0; idx < 40; idx++) {
              mockData.push(Math.random())
            }
            return new PredictionSampleStepData(mockData, v)
          })

          return new PredictionSampleRowData(sample, run_id, steps)
        })
  }

  async getSamplePredictionsForGroup(group: string, sample: string, compression: number): Promise<PredictionSampleData> {
    let promises: Promise<PredictionSampleRowData>[] = []
    for (let run_id = 1; run_id <= RUNS_PER_GROUP; run_id++) {
      promises.push(this.getSamplePredictionsForRun(group, run_id, sample, compression))
    }
    return Promise.all(promises)
      .then(values => {
        return new PredictionSampleData(sample, values)
      })
  }

}

// "Main" - run on bootup
let DATA = new DataCollector()


// =============================================
// =============================================
// =============================================
// =========== SHAPES === ======================
// =============================================
// =============================================
// =============================================

class Rectangle {
  left: number;
  right: number;
  top: number;
  bottom: number;
  constructor(left: number, top: number, right: number, bottom: number) {
    this.left = left;
    this.right = right;
    this.top = top;
    this.bottom = bottom;
  }
  get width() {
    return this.right - this.left;
  }

  get height() {
    return this.top - this.bottom;
  }

  withinDomains(x: any, y: any) {
    return new Rectangle(x(this.left), y(this.top), x(this.right), y(this.bottom))
  }

}

class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y
  }
}

class Size {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height
  }
}

class GraphShape {
  protected _parent: any
  protected _xAxis: XAxis
  protected _yAxis: YAxis
  protected _boundingBox: Rectangle = new Rectangle(0, 0, 1, 1)
  protected _g: any = null
  protected _hidden: boolean = false
  constructor(parent: any, xAxis: XAxis, yAxis: YAxis) {
    this._parent = parent
    this._xAxis = xAxis
    this._yAxis = yAxis
  }
  setAxes(xAxis: XAxis, yAxis: YAxis) {
    this._xAxis = xAxis
    this._yAxis = yAxis
    this.rebuild()
  }
  get g () { return this._g }
  get boundingBox(): Rectangle {
    return this._boundingBox
  }
  hide () {
    this._hidden = true
    this._g.attr('visibility', 'hidden')
  }
  unhide () {
    this._hidden = false
    this._g.attr('visibility', 'visible')
  }
  get hidden () { return this._hidden }
  rebuild() {}
}

class GraphShapePointBased extends GraphShape {
  protected _points: Point[]
  constructor(parent: any, xAxis: XAxis, yAxis: YAxis, points: Point[]) {
    super(parent, xAxis, yAxis)
    this._points = points
    this._buildBoundingBox()
  }
  set points(points: Point[]) {
    this._points = points
    this._buildBoundingBox()
  }
  get points(): Point[] { return this._points }
  get xValues(): number[] {
    return this._points.map(function(p: Point) { return p.x })
  }
  get yValues(): number[] {
    return this._points.map(function(p: Point) { return p.y })
  }
  protected _buildBoundingBox() {
    let xValues = this.xValues
    let yValues = this.yValues
    this._boundingBox = new Rectangle(
      Math.min(...xValues),
      Math.max(...yValues),
      Math.max(...xValues),
      Math.min(...yValues)
    )
  }
}

class Line extends GraphShapePointBased {
  constructor(parent: any, xAxis: XAxis, yAxis: YAxis, points: Point[]) {
    super(parent, xAxis, yAxis, points)
    this._g = parent.append("path")
      .attr("fill", "none")
      .attr("stroke", 'black')
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 1.5)
    this.rebuild()
  }

  rebuild() {
    // Build line function
    let pointsFunc = d3.line()
      .x(this._xAxis.domainPointFunction())
      .y(this._yAxis.domainPointFunction())

    this._g.datum(this._points)
      .attr("d", pointsFunc);
  }
}

class Polygon extends GraphShapePointBased {
  constructor(parent: any, xAxis: XAxis, yAxis: YAxis, points: Point[]) {
    super(parent, xAxis, yAxis, points)
    this._g = parent.append("polygon")
      .attr('fill', 'black')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
    this.rebuild()
  }

  rebuild() {
    // Build line function
    let xDomain = this._xAxis.domainPointFunction()
    let yDomain = this._yAxis.domainPointFunction()
    let pointsFunc = function(data: Point[]) {
      return data.map(function(point: Point) {
        return [xDomain(point), yDomain(point)].join(",")
      }).join(" ")
    }

    // Set data into the polygon
    this._g.datum(this._points)
      .attr('points', pointsFunc)
  }
}

class GraphShapeRectangleBased extends GraphShape {
  protected _rectangle: Rectangle
  constructor(parent: any, xAxis: XAxis, yAxis: YAxis, rectangle: Rectangle) {
    super(parent, xAxis, yAxis)
    this._rectangle = rectangle
    this._boundingBox = rectangle
  }
  set rectangle(rectangle: Rectangle) {
    this._rectangle = rectangle
    this._boundingBox = rectangle
    this.rebuild()
  }
}

class Box extends GraphShapeRectangleBased {
  constructor(parent: any, xAxis: XAxis, yAxis: YAxis, rectangle: Rectangle) {
    super(parent, xAxis, yAxis, rectangle)
    this._g = parent.append("rect")
      .attr('fill', 'lightgray')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
    this.rebuild()
  }

  rebuild() {
    // Build line function
    let inDomain = this._rectangle.withinDomains(
      this._xAxis.domainNumberFunction(),
      this._yAxis.domainNumberFunction()
    )
    this._g.attr('x', inDomain.left)
      .attr('y', inDomain.top)
      .attr('width', inDomain.width)
      .attr('height', -inDomain.height)
  }
}

// =============================================
// =============================================
// =============================================
// =========== GRAPH AXES ======================
// =============================================
// =============================================
// =============================================
class LineGraphAxis {
  protected _chartSize: Size = new Size(2, 2)
  protected _dataRange: number[] = [1, 2]
  protected _domain: any
  protected _gParent: d3.Selection<SVGGElement, any, any, any>
  protected _gAxis: d3.Selection<SVGGElement, any, any, any>
  protected _gText: any

  protected _noTicks: boolean = false
  protected _noLine: boolean = false

  constructor(gParent: d3.Selection<SVGGElement, any, any, any>) {
    this._gParent = gParent
    this._gAxis = gParent
      .append("g")
      .attr('class', 'axis')
    this._buildAxisText()

  }
  set chartSize(size: Size) {
    if (size.width != this._chartSize.width || size.height != this._chartSize.height) {
      this._chartSize = size
      this._chartSizeUpdated()
      this._rebuildDomain()
      this._updateRemovals()
    }
  }
  get chartSize() { return this._chartSize }

  get domain() {
    return this._domain
  }
  get g() { return this._gAxis }
  get gText() { return this._gText }

  removeTicks () {
    this._gAxis.selectAll('g').remove()
    this._noTicks = true
  }
  removeLine () {
    this._gAxis.select('path').remove()
    this._noLine = true
  }

  domainPointFunction(): any {}
  domainNumberFunction(): any {
    let domain = this._domain
    return function(value: number): number {
      return domain(value)
    }
  }

  protected _buildAxisText() {
    // Implemented by child
  }
  protected _axisPixelRange(): number[] {
    // Implemented by child
    return [1, 2]
  }

  protected _chartSizeUpdated() {

  }

  protected _rebuildDomain() {
    this._domain = d3.scaleLinear().rangeRound(this._axisPixelRange());
    this._domain.domain(this._dataRange)
  }

  setDataRange(low: number, high: number) {
    this._dataRange = [low, high]
    this._rebuildDomain()
    this._updateRemovals()
  }

  protected _updateRemovals() {
    if (this._noLine) { this.removeLine() }
    if (this._noTicks) { this.removeTicks() }
  }
}

class YAxis extends LineGraphAxis {

  protected _axisPixelRange(): number[] {
    return [this._chartSize.height, 0]
  }

  protected _chartSizeUpdated() {
    this._gText.attr("x", -this._chartSize.height/2)
      .attr('y', -35)
  }

  protected _buildAxisText() {
    this._gText = this._gAxis.append("text")
      .attr("fill", "#000")
      .attr('font-size', '14px')
      .attr("transform", "rotate(-90)")
      .attr("text-anchor", "middle")
      .text("Step Reward");
    this._chartSizeUpdated()
  }

  protected _rebuildDomain() {
    super._rebuildDomain()
    this._gAxis.call(d3.axisLeft(this._domain).ticks(6))
  }

  domainPointFunction(): any {
    let domain = this._domain
    return function(point: Point): number {
      return domain(point.y)
    }
  }

}

class XAxis extends LineGraphAxis {

  private _top: boolean = false

  set top(top: boolean) {
    this._top = top
    this._rebuildDomain()
  }
  get top() { return this._top }

  protected _axisPixelRange(): number[] {
    return [0, this._chartSize.width]
  }

  protected _chartSizeUpdated() {
    let text = this._gText.attr('x', this._chartSize.width/2)
    if (this._top) {
      text.attr("y", -20)
    } else {
      text.attr("y", 36)
    }
  }

  protected _buildAxisText() {
    this._gText = this._gAxis.append("text")
      .attr("fill", "#000")
      .attr('font-size', '14px')
      .attr('x', this._chartSize.width/2)
      .attr("y", 36)
      .attr("text-anchor", "middle")
      .text("Training Step");
    this._chartSizeUpdated()
  }

  protected _rebuildDomain() {
    super._rebuildDomain()

    let axisCall: any = null
    if (this._top) {
      axisCall = d3.axisTop(this._domain)
    } else {
      axisCall = d3.axisBottom(this._domain)
    }

    let axis = this._gAxis.call(axisCall.ticks(4))

    // Organize based on if on top or bottom
    if (this._top) {
      axis.attr("transform", "translate(0,0)")
    } else {
      axis.attr("transform", "translate(0," + this._chartSize.height + ")")
    }
  }

  domainPointFunction(): any {
    let domain = this._domain
    return function(point: Point): number {
      return domain(point.x)
    }
  }
}


// =============================================
// =============================================
// =============================================
// =========== GRAPH ===========================
// =============================================
// =============================================
// =============================================

class ShapeRegion {
  private _g: d3.Selection<SVGGElement, any, any, any>;
  private _size: Size = new Size(600, 200)
  protected _boundingPadding: Rectangle = new Rectangle(0, 0.05, 0, 0.05)

  // Axes
  protected _yAxis: YAxis
  protected _xAxis: XAxis

  // Shapes
  protected _gShapes: any
  protected _shapes: GraphShape[] = []

  constructor(g: d3.Selection<SVGGElement, any, any, any>) {
    this._g = g
    this._gShapes = g
      .append('g')
      .attr('class', 'shapes')
      .attr('fill', 'lightgray')
    this._yAxis = new YAxis(g)
    this._xAxis = new XAxis(g)
    this.updateAxes()
  }

  get g() { return this._g }

  get yAxis() { return this._yAxis }
  get xAxis() { return this._xAxis }

  set size(size: Size) {
    this._size = size
    this.updateAxes()
  }
  get size() { return this._size }

  getAllBoundingBox(): Rectangle {
    let boxes: Rectangle[] = []
    for (let idx in this._shapes) {
      let shape = this._shapes[idx]
      if (!shape.hidden) {
        boxes.push(this._shapes[idx].boundingBox)
      }
    }
    if (boxes.length > 0) {
      return new Rectangle(
        Math.min(...boxes.map(function(r: Rectangle) { return r.left })),
        Math.max(...boxes.map(function(r: Rectangle) { return r.top })),
        Math.max(...boxes.map(function(r: Rectangle) { return r.right })),
        Math.min(...boxes.map(function(r: Rectangle) { return r.bottom }))
      )
    }
    return new Rectangle(0, 1, 1, 0)
  }

  updateAxes() {
    // Determine bounding boxe
    let box = this.getAllBoundingBox()

    // Set axes
    this._xAxis.setDataRange(
      box.left - this._boundingPadding.left * box.width,
      box.right + this._boundingPadding.right * box.width
    )
    this._yAxis.setDataRange(
      box.bottom - this._boundingPadding.bottom * box.height,
      box.top + this._boundingPadding.top * box.height
    )

    // Apply the size
    this._yAxis.chartSize = this._size
    this._xAxis.chartSize = this._size
    for (let idx in this._shapes) {
      this._shapes[idx].rebuild()
    }
  }

  addLine(points: Point[], color: string = 'red') {
    let line = new Line(this._gShapes, this._xAxis, this._yAxis, points)
    line.g.attr('stroke', color)
    this._shapes.push(line)
    this.updateAxes()
    return line
  }

  addBox(rectangle: Rectangle, fill: string = 'lightgray', stroke: string = 'black') {
    let box = new Box(this._gShapes, this._xAxis, this._yAxis, rectangle)
    box.g.attr('fill', fill)
      .attr('stroke', stroke)
    this._shapes.push(box)
    this.updateAxes()
    return box
  }

  addPolygon(points: Point[], fill: string = 'lightblue', stroke: string = 'blue') {
    let polygon = new Polygon(this._gShapes, this._xAxis, this._yAxis, points)
    polygon.g.attr('fill', fill)
    polygon.g.attr('stroke', stroke)
    this._shapes.push(polygon)
    this.updateAxes()
    return polygon
  }

  removeShape(shape: any) {
    this._shapes = this._shapes.filter(function(s: GraphShape) {
      return s != shape
    })
    this.updateAxes()
  }

}








const CURVE_BOXPLOT_FILL = '#f5f5ff'
const CURVE_BOXPLOT_LINE = '#dbdbff'


class RewardsGraph extends ShapeRegion {

  private _curveBoxplotShape: Polygon
  private _curveBoxplotCenterline: Line
  private _runLines: Line[] = []

  constructor() {
    super(d3.select('#rewards-chart'))

    // Add a polygon and hide it
    this._curveBoxplotShape = this.buildCurveBoxplotShape()
    this._curveBoxplotCenterline = this.buildCurveBoxplotCenterline()

    // Put the X axis on top
    this._xAxis.top = true
  }

  private buildCurveBoxplotShape(): Polygon {
    let shape = this.addPolygon([new Point(0, 0), new Point(0, 1), new Point (1, 0)])
    shape.g
      .attr('fill', CURVE_BOXPLOT_FILL)
      .attr('stroke', CURVE_BOXPLOT_LINE)
    shape.hide()
    return shape
  }

  private buildCurveBoxplotCenterline(): Line {
    let line = this.addLine([new Point(0, 0), new Point(1, 1)], CURVE_BOXPLOT_LINE)
    line.hide()
    return line
  }


  loadCurveBoxplotData(group: string) {
    DATA.getGroupMetrics(group, DATA_COMPRESSION_SHAPE)
      .then(metrics => {
        metrics.applyEwma(EWMA_BETA_SHAPE)

        // Update background shape
        this._curveBoxplotShape.unhide()
        this._curveBoxplotShape.points = metrics.midlineShape()

        // Centerline
        this._curveBoxplotCenterline.unhide()
        this._curveBoxplotCenterline.points = metrics.p50.points

        // Update
        this.updateAxes()
      })
  }

  loadRunLines(group: string) {
    // Remove old lines
    this._runLines.forEach(line => line.g.remove())
    this._runLines = []

    // Add lines
    DATA.getRunField(group, 1, DATA_COMPRESSION_LINES, 'rewards')
      .then(runData => {
        runData.applyEwma(EWMA_BETA_LINES)
        let line = this.addLine(runData.points, GROUP_COLORS[runData.group])
        this._runLines.push(line)
      })
  }

}













// ===================================================
// ===================================================
// ===================================================
// =========== SPECTROGRAM ===========================
// ===================================================
// ===================================================
// ===================================================

class SimpleG {

  g: SVGGElement
  gSelection: d3.Selection<SVGGElement, any, any, any>
  width: number
  height: number

  constructor(g: SVGGElement, width: number, height: number) {
    this.g = g
    this.gSelection = d3.select(g)
    this.width = width
    this.height = height
  }

}

class SpectrogramRow extends SimpleG {

  values: number[] = []

  constructor(g: SVGGElement, width: number, height: number) {
    super(g, width, height)
  }

  private rebuild(values: number[]) {
    this.gSelection
      .selectAll('rect')
      .remove()

    let xLoc = d3.scaleLinear()
      .domain([0, values.length])
      .range([0, this.width])

    // Create the boxes
    this.gSelection
      .selectAll('rect')
      .data(values)
      .enter()
      .append('rect')
      .attr('x', (d, i) => xLoc(i))
      .attr('y', 0)
      .attr('width', xLoc(1))
      .attr('height', this.height)
  }

  checkRebuild(values: number[]) {
    if (values.length != this.values.length) {
      this.rebuild(values)
    }
  }

  data(steps: PredictionSampleStepData[]) {
    // Map
    let values = steps.map(s => s.totalDELETE)

    // Rebuild
    this.checkRebuild(values)
    let colorDomain = d3.scaleSequential(d3.interpolateRdYlGn)
      .domain([0, 1])

    this.gSelection
      .selectAll('rect')
      .data(values)
      .attr('fill', d => colorDomain(d))
  }

}

class Spectrogram extends SimpleG {

  g: SVGGElement
  gSelection: d3.Selection<SVGGElement, any, any, any>
  width: number
  height: number

  label: any
  rows: SpectrogramRow[] = []

  constructor(g: SVGGElement, width: number, height: number) {
    super(g, width, height)

    this.label = this.gSelection
      .append('text')
      .attr("fill", "#000")
      .attr('font-size', '10px')
      .attr('x', -5)
      .attr('y', height/2 +3)
      .attr("text-anchor", "end")
      .text("label");

    // Create a background rectangle
    this.gSelection.append('rect')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'spectrogramBackground')
  }

  private rebuild(numRows: number) {
    this.rows.forEach(r => r.g.remove())
    this.rows = []

    // Determine vertical scale
    let verticalScale = d3.scaleLinear()
      .domain([0, numRows])
      .range([0, this.height])
    let rowHeight = verticalScale(1)

    // Build each of the rows
    for (let index = 0; index < numRows; index ++) {
      let rowG = this.gSelection
        .append('g')
        .attr('width', this.width)
        .attr('height', rowHeight)
        .attr('transform', 'translate(0, ' + verticalScale(index) + ')')
        .nodes()[0]
      this.rows.push(new SpectrogramRow(rowG, this.width, rowHeight))
    }
  }

  checkRebuild(numRows: number) {
      if (numRows != this.rows.length) {
        this.rebuild(numRows)
      }
  }

  data(rows: PredictionSampleRowData[]) {
    // Check for a rebuild
    this.checkRebuild(rows.length)

    // Set the datavalues
    rows.forEach((row, index) => {
      this.rows[index].data(row.steps)
    })
  }

  set text (text: string) {
    this.label.text(text)
  }

}

class SpectrogramsArea extends SimpleG {

  samples: string[] = []
  spectrogramsMap: {[key: string]: Spectrogram} = {}

  constructor() {
    super(d3.select('#spectrograms').node() as any, 600, 150)
  }

  private rebuild(samples: string[]) {
    // Determine the band size for the spectrograms
    this.samples = samples
    let spectrogram_vertical_band = d3.scaleBand()
      .domain(samples)
      .range([0, this.height])
      .paddingInner(0.1)

    // Remove existing spectrograms
    this.gSelection.selectAll('g').remove()
    this.spectrogramsMap = {}

    // Build the new ones
    this.gSelection
      .selectAll('g')
      .data(samples)
      .enter()
      .append('g')
      .attr('transform', d => 'translate(0, ' + spectrogram_vertical_band(d) + ')')
      .attr('height', spectrogram_vertical_band.bandwidth())
      .attr('class', 'spectrogram')
      .nodes()
      .forEach(n => {
        let data: any = d3.select(n).datum()
        let spectrogram = new Spectrogram(n, this.width, spectrogram_vertical_band.bandwidth())
        this.spectrogramsMap[data] = spectrogram
      })
  }

  checkRebuild(samples: string[]) {
    if (samples.length != this.samples.length) {
      this.rebuild(samples)
    }
  }

  data(data: PredictionSampleData[]) {
    // Check for a rebuild (make a unique set of samples)
    let samples = data.map(s => s.sample)
    this.checkRebuild(samples)

    // Populate the data
    data.forEach(d => {
      let s = this.spectrogramsMap[d.sample]
      s.data(d.rows)
      s.text = d.sample
    })
  }

}



// =======================================================
// =======================================================
// =======================================================
// =========== CONFUSIONMATRIX ===========================
// =======================================================
// =======================================================
// =======================================================

class PredictionMatrix extends ShapeRegion {

  squares: Box[] = []

  constructor() {
    super(d3.select('#predictions'))
    this.size = new Size(100, 160)
    this._boundingPadding = new Rectangle(0, 0, 0, 0)
    this._xAxis.removeTicks()
    this._xAxis.removeLine()
    this._xAxis.gText.text('Steering').attr('y', 15)

    this._yAxis.removeTicks()
    this._yAxis.removeLine()
    this._yAxis.gText.text('Throttle').attr('y', -10)

    // Determine bands
    let xDomain = d3.scaleLinear()
      .domain([0, STEER_ACTIONS])
      .range([0, this.size.width])
    let yDomain = d3.scaleLinear()
      .domain([0, THROTTLE_ACTIONS])
      .range([this.size.height, 0])

    let xBandwidth = xDomain(1)
    let yBandwidth = yDomain(THROTTLE_ACTIONS-1) - yDomain(THROTTLE_ACTIONS)

    // 40 data points
    for (let idx = 0; idx < NUM_ACTIONS; idx ++) {
      let xVal = xDomain(idx % STEER_ACTIONS)
      let yVal = yDomain(Math.floor(idx / STEER_ACTIONS))
      let box = this.addBox(new Rectangle(xVal, yVal + yBandwidth, xVal + xBandwidth, yVal))
      this.squares.push(box)
    }
  }

}


// =============================================
// =============================================
// =============================================
// =========== SETUP ===========================
// =============================================
// =============================================
// =============================================

// Build the components first
let REWARDS_GRAPH = new RewardsGraph()
let SPECTROGRAMS = new SpectrogramsArea()
let PREDICTIONS = new PredictionMatrix()

// Populate the rewards
// REWARDS_GRAPH.loadCurveBoxplotData('blocks')
// REWARDS_GRAPH.loadRunLines('blocks')

// Populate the spectrogram area + predictions matrix
DATA.getAllSamples()
  .then(samples => {
    let promises: Promise<PredictionSampleData>[] = []
    samples.forEach(function(sample) {
      promises.push(DATA.getSamplePredictionsForGroup(sample, sample, DATA_COMPRESSION_PREDICTIONS))
    })
    return Promise.all(promises)
  })
  .then(data => {
    SPECTROGRAMS.data(data)
  })




// ========================================================================
// ========================================================================
// ========================================================================
// ========================================================================
// [ ] Allow generation of fake prediction data across the 40 actions (apply softmax)
    // [ ] Normalize post-softmax, so min value is 0 and max is 1
// [ ] Predictions "confusion" matrix underneath the spectrograms w/ mock data
    // [ ] 5 columns, 8 rows
    // [ ] colorized based on value

// [ ] Click on a point on the rewards graph to draw a cyan vertical line
    // [ ] Update predictions matrix accordingly

// [ ] Allow clicking on a spectrogram to select that sample w/ cyan
    // [ ] Update the predictions matrix accordingly w/ title
    // [ ] Have first spectrogram start off selected

// [ ] Have the contour metrics properly adapt for when runs are different lengths
// [ ] Merge to master
