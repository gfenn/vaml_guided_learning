
let RUNS_PER_GROUP = 3
let DATA_COMPRESSION = 1000
let EWMA_BETA = 0.01

let GROUP_COLORS: {[key: string]: string} = {
    'blocks': 'red',
    'deeplab': 'lightgreen'
}

let FORMAL_NAME: {[key: string]: string} = {
    'blocks': 'Blocks',
    'deeplab': 'Deeplab'
}

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
  width() {
    return this.right - this.left;
  }

  height() {
    return this.top - this.bottom;
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

// =============================================
// =============================================
// =============================================
// =========== SHAPES === ======================
// =============================================
// =============================================
// =============================================

class GraphShape {
  protected _parent: any
  protected _xAxis: XAxis
  protected _yAxis: YAxis
  protected _points: Point[]
  protected _boundingBox: Rectangle = new Rectangle(0, 0, 1, 1)
  protected _g: any = null
  constructor(parent: any, xAxis: XAxis, yAxis: YAxis, points: Point[]) {
    this._parent = parent
    this._xAxis = xAxis
    this._yAxis = yAxis
    this._points = points
    this._buildBoundingBox()
  }
  setAxes(xAxis: XAxis, yAxis: YAxis) {
    this._xAxis = xAxis
    this._yAxis = yAxis
    this.rebuild()
  }
  get g () { return this._g }
  set points(points: Point[]) {
    this._points = points
    this._buildBoundingBox()
    this.rebuild()
  }
  get points(): Point[] { return this._points }
  get xValues(): number[] {
    return this._points.map(function(p: Point) { return p.x })
  }
  get yValues(): number[] {
    return this._points.map(function(p: Point) { return p.y })
  }
  get boundingBox(): Rectangle {
    return this._boundingBox
  }
  protected _buildBoundingBox() {
    let xValues = this.xValues
    let yValues = this.yValues
    this._boundingBox = new Rectangle(
      Math.min(...xValues),
      Math.min(...yValues),
      Math.max(...xValues),
      Math.max(...yValues)
    )
  }
  rebuild() {}
}

class Line extends GraphShape {
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

  get g(): any { return this._g }

  rebuild() {
    // Build line function
    let pointsFunc = d3.line()
      .x(this._xAxis.domainFunction())
      .y(this._yAxis.domainFunction())

    this._g.datum(this._points)
      .attr("d", pointsFunc);
  }
}

class ShapeRect extends GraphShape {
  constructor(parent: any, xAxis: XAxis, yAxis: YAxis, points: Point[]) {
    super(parent, xAxis, yAxis, points)
    this._g = parent.append("rect")
      .attr('fill', 'lightgray')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
    this.rebuild()
  }

  get g(): any { return this._g }

  rebuild() {
    // Build line function
    let xFunc = this._xAxis.domainFunction()
    let yFunc = this._yAxis.domainFunction()
    let x1 = xFunc(this._points[0])
    let y1 = yFunc(this._points[0])
    this._g.datum(this._points)
      .attr('x', x1)
      .attr('y', y1)
      .attr('width', xFunc(this._points[1]) - x1)
      .attr('height', yFunc(this._points[1]) - y1)
  }
}

class Polygon extends GraphShape {
  constructor(parent: any, xAxis: XAxis, yAxis: YAxis, points: Point[]) {
    super(parent, xAxis, yAxis, points)
    this._g = parent.append("polygon")
      .attr('fill', 'black')
      .attr('stroke', 'black')
      .attr('stroke-width', 1)
    this.rebuild()
  }

  get g(): any { return this._g }

  rebuild() {
    // Get constants
    let xDomain = this._xAxis.domainFunction()
    let yDomain = this._yAxis.domainFunction()

    // Build line function
    let pointsFunc = function(data: Point[]) {
      let converted = data.map(function(point: Point) {
        let x = xDomain(point)
        let y = yDomain(point)
        return [x, y].join(",")
      })
      return converted.join(" ");
    }

    this._g.datum(this._points)
      .attr('points', pointsFunc)
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
  protected _gParent: any
  protected _gAxis: any
  protected _gText: any

  constructor(gParent: any) {
    this._gParent = gParent
    this._gAxis = gParent.append("g")
      .attr('class', 'axis')
    this._buildAxisText()

  }
  set chartSize(size: Size) {
    this._chartSize = size
    this._rebuildDomain()
  }
  get chartSize() { return this._chartSize }

  get domain() {
    return this._domain
  }

  domainFunction(): any {
    // Implemented by children
  }

  protected _buildAxisText() {
    // Implemented by child
  }
  protected _axisPixelRange(): number[] {
    // Implemented by child
    return [1, 2]
  }

  protected _rebuildDomain() {
    this._domain = d3.scaleLinear().rangeRound(this._axisPixelRange());
    this._domain.domain(this._dataRange)
  }

  setDataRange(low: number, high: number) {
    this._dataRange = [low, high]
    this._rebuildDomain()
  }
}

class YAxis extends LineGraphAxis {

  protected _axisPixelRange(): number[] {
    return [this._chartSize.height, 0]
  }

  protected _buildAxisText() {
    this._gText = this._gAxis.append("text")
      .attr("fill", "#000")
      .attr('font-size', '14px')
      .attr("transform", "rotate(-90)")
      .attr("x", -this._chartSize.height/2)
      .attr('y', -35)
      .attr("text-anchor", "middle")
      .text("Step Reward");
  }

  protected _rebuildDomain() {
    super._rebuildDomain()
    this._gAxis.call(d3.axisLeft(this._domain))
    this._gText.attr("x", -this._chartSize.height/2)
      .attr('y', -35)
  }

  domainFunction(): any {
    let domain = this._domain
    return function(point: Point): number {
      return domain(point.y)
    }
  }

}

class XAxis extends LineGraphAxis {

  protected _axisPixelRange(): number[] {
    return [0, this._chartSize.width]
  }

  protected _buildAxisText() {
    this._gText = this._gAxis.append("text")
      .attr("fill", "#000")
      .attr('font-size', '14px')
      .attr('x', this._chartSize.width/2)
      .attr("y", 36)
      .attr("text-anchor", "middle")
      .text("Training Step");
  }

  protected _rebuildDomain() {
    super._rebuildDomain()
    this._gAxis.call(d3.axisBottom(this._domain).ticks(4))
      .attr("transform", "translate(0," + this._chartSize.height + ")")
    this._gText.attr('x', this._chartSize.width/2)
      .attr("y", 36)
  }

  domainFunction(): any {
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
  private _g: any;
  private _size: Size = new Size(530, 330)

  // Axes
  protected _yAxis: YAxis
  protected _xAxis: XAxis

  // Shapes
  protected _gShapes: any
  protected _shapes: GraphShape[] = []

  constructor(g: any) {
    this._g = g
    this._gShapes = g.append('g')
      .attr('class', 'shapes')
      .attr('fill', 'lightgray')
    this._gShapes.append('rect')
      .attr('')
    this._yAxis = new YAxis(g)
    this._xAxis = new XAxis(g)
    this.updateAxes()
  }

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
      boxes.push(this._shapes[idx].boundingBox)
    }
    if (boxes.length > 0) {
      return new Rectangle(
        Math.min(...boxes.map(function(r: Rectangle) { return r.left })),
        Math.min(...boxes.map(function(r: Rectangle) { return r.top })),
        Math.max(...boxes.map(function(r: Rectangle) { return r.right })),
        Math.max(...boxes.map(function(r: Rectangle) { return r.bottom }))
      )
    }
    return new Rectangle(0, 0, 1, 1)
  }

  updateAxes() {
    // Determine bounding boxe
    let box = this.getAllBoundingBox()
    this._xAxis.setDataRange(box.left, box.right)
    this._yAxis.setDataRange(box.top, box.bottom)

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


// =============================================
// =============================================
// =============================================
// =========== DATA FIELDS =====================
// =============================================
// =============================================
// =============================================

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


class DataCollector {

  private _arrayToPoints(values: number[], compression: number): Point[] {
    let points: Point[] = []
    values.forEach(function(value: number, idx: number) {
      points.push(new Point((idx + 1) * compression, value))
    })
    return points
  }

  async getRunField(group: string, run: number, compression: number, field: string): Promise<DataRunField> {
    let atp = this._arrayToPoints
    return fetch('data/run_field?group=' + group
                 + '&run=' + run
                 + '&compression=' + compression
                 + '&field=' + field)
        .then(function(response) { return response.json(); })
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

}






// =============================================
// =============================================
// =============================================
// =========== MAIN ============================
// =============================================
// =============================================
// =============================================


// "Main" - run on bootup
let data = new DataCollector()
// let graph = new LineGraph(d3.select('#rewards-chart'))
// graph.xAxis.multiplier = DATA_COMPRESSION
let rewardsChartG = d3.select('#rewards-chart')
rewardsChartG.attr('transform', 'translate(80, 50)')
let graph = new ShapeRegion(rewardsChartG)

data.getGroupMetrics('blocks', DATA_COMPRESSION * 10)
  .then(function(metrics: DataGroupMetrics) {
    metrics.applyEwma(EWMA_BETA * 10)
    graph.addPolygon(metrics.midlineShape())
    graph.addLine(metrics.p50.points, 'blue')
  })
  .then(function() {
    return data.getAllGroupsField(['blocks'], DATA_COMPRESSION, 'rewards')
  })
  .then(function(groupData: DataMultipleGroupRunFields) {
    groupData.applyEwma(EWMA_BETA)
    for (let groupKey in groupData.groups) {
      let group: DataGroupRunFields = groupData.groups[groupKey]
      let groupColor = GROUP_COLORS[groupKey]
      for (let runKey in group.runs) {
        graph.addLine(group.runs[runKey].points, groupColor)
      }
    }
  })
