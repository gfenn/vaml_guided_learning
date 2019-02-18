
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
  private _pointsFunc: d3.Line<[number, number]>

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
    // Get constants
    let xMult = this._xAxis.multiplier
    let yMult = this._yAxis.multiplier
    let xDomain = this._xAxis.domain
    let yDomain = this._yAxis.domain

    // Build line function
    this._pointsFunc = d3.line()
      .x(function(p: any) {
        return xDomain(p.x * xMult)
      })
      .y(function(p: any) {
        return yDomain(p.y * yMult)
      })

    this._g.datum(this._points)
      .attr("d", this._pointsFunc);
  }
}

class Polygon extends GraphShape {
  private _pointsFunc: any

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
    let xMult = this._xAxis.multiplier
    let yMult = this._yAxis.multiplier
    let xDomain = this._xAxis.domain
    let yDomain = this._yAxis.domain

    // Build line function
    this._pointsFunc = function(data: Point[]) {
      let converted = data.map(function(point: Point) {
        let x = xDomain(point.x * xMult)
        let y = yDomain(point.y * yMult)
        return [x, y].join(",")
      })
      return converted.join(" ");
    }

    this._g.datum(this._points)
      .attr('points', this._pointsFunc)
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
  protected _multiplier: number = 1
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

  set multiplier(multiplier: number) {
    let delta = multiplier / this._multiplier
    this._multiplier = multiplier
    this._dataRange = [
      this._dataRange[0] * delta,
      this._dataRange[1] * delta
    ]
    this._rebuildDomain()
  }
  get multiplier() { return this._multiplier }

  get domain() {
    return this._domain
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
    this._dataRange = [low * this._multiplier, high * this._multiplier]
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
}


// =============================================
// =============================================
// =============================================
// =========== GRAPH ===========================
// =============================================
// =============================================
// =============================================

class LineGraph {

  // Group that this line graph belongs to
  private _g: any;
  private _margin: Rectangle = new Rectangle(50, 50, 50, 50)
  private _size: Size = new Size(530, 330)

  // Data points are compressed, so we need to expand them back
  // out when determining the domain
  xCompression: number = 1000

  // Axes
  protected _yAxis: YAxis
  protected _xAxis: XAxis

  // Shapes
  protected _gShapes: any
  protected _shapes: GraphShape[] = []

  constructor(g: any) {
    this._g = g
    this._gShapes = g.append('g')
      .attr('class', 'graph-shapes')
    this._yAxis = new YAxis(g)
    this._xAxis = new XAxis(g)
    this._updateChartSize()
    this.updateAxes()
  }

  get yAxis() { return this._yAxis }
  get xAxis() { return this._xAxis }

  set size(size: Size) {
    this._size = size
    this.updateAxes()
  }
  get size() { return this._size }

  set margins(margins: Rectangle) {
    this._margin = margins
    this._updateChartSize
  }
  get margins() { return this._margin }

  private _updateChartSize() {
    this._g.attr("transform",
        "translate(" + this._margin.left + "," + this._margin.top + ")"
    );
  }

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

  addLengthLine(points: Point[], color: string = 'red') {
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
  compression: number
  field: string
  constructor(group: string, field: string, compression: number) {
    this.group = group
    this.compression = compression
    this.field = field
  }
}

class DataField extends DataFieldI {
  values: number[]
  constructor(group: string, field: string, compression: number, values: number[]) {
    super(group, field, compression)
    this.values = values
  }

  applyEwma(beta: number) {
    let values = this.values
    let ewma = values[0]
    values.forEach(function(value: number, idx: number) {
        ewma = value * beta + ewma * (1 - beta)
        values[idx] = ewma
    })
  }
}

class DataRunField extends DataField {
  run_id: number
  constructor(group: string, run_id: number, compression: number, field: string, values: number[]) {
    super(group, field, compression, values)
    this.run_id = run_id
  }
}

class DataGroupRunFields extends DataFieldI {
    runs: DataRunField[]
    constructor(runs: DataRunField[]) {
      super(runs[0].group, runs[0].field, runs[0].compression)
      this.runs = runs
    }

    applyEwma(beta: number) {
      for (let run in this.runs) { this.runs[run].applyEwma(beta) }
    }
    getAllData(): number[][] {
      return this.runs.map(function(run: DataRunField) {
        return run.values
      })
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

  getAllData(): number[][] {
    let all: number[][] = []
    let groups = this.groups
    Object.keys(groups).forEach(function(key: string) {
      let data = groups[key].getAllData()
      for (let idx in data) {
        all.push(data[idx])
      }
    })
    return all
  }
}

class DataGroupMetrics extends DataFieldI {
  p25: DataField
  p50: DataField
  p75: DataField
  constructor(group: string, compression: number, metrics: any) {
    super(group, 'metrics', compression)
    this.p25 = new DataField(group, 'p25', compression, metrics['p25'])
    this.p50 = new DataField(group, 'p50', compression, metrics['p50'])
    this.p75 = new DataField(group, 'p75', compression, metrics['p75'])
  }

  applyEwma(beta: number) {
    this.p25.applyEwma(beta)
    this.p50.applyEwma(beta)
    this.p75.applyEwma(beta)
  }

  getAllData(): number[][] {
    let all: number[][] = []
    all.push(this.p25.values)
    all.push(this.p50.values)
    all.push(this.p75.values)
    return all
  }

  dataAsPoints(): Point[] {
    let points: Point[] = []
    // Start wth p25
    this.p25.values.forEach(function(value: number, idx: number) {
      points.push(new Point(idx + 1, value))
    })
    // Now add p75 in reverse
    let length = this.p75.values.length
    this.p75.values.reverse().forEach(function(value: number, idx: number) {
      points.push(new Point(length - idx, value))
    })
    return points
  }
}


class DataCollector {

  async getRunField(group: string, run: number, compression: number, field: string): Promise<DataRunField> {
    return fetch('data/run_field?group=' + group
                 + '&run=' + run
                 + '&compression=' + compression
                 + '&field=' + field)
        .then(function(response) { return response.json(); })
        .then(function(values) {
          return new DataRunField(group, run, compression, field, values)
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
    return fetch('data/group_metrics?group=' + group
                 + '&compression=' + compression)
        .then(function(response) { return response.json(); })
        .then(function(metrics) {
          return new DataGroupMetrics(group, compression, metrics)
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
let graph = new LineGraph(d3.select('#rewards-chart'))
graph.xAxis.multiplier = DATA_COMPRESSION

data.getGroupMetrics('blocks', DATA_COMPRESSION)
  .then(function(metrics: DataGroupMetrics) {
    metrics.applyEwma(EWMA_BETA)
    graph.addPolygon(metrics.dataAsPoints())
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
        let points = group.runs[runKey].values.map(function (value: number, idx: number) {
          return new Point(idx+1, value)
        })
        graph.addLengthLine(points, groupColor)
      }
    }
  })
