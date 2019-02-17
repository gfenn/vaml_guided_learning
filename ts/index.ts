
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


class Size {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height
  }
}



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
  setDataRangeFromData(data: number[]) {
    let range = d3.extent(data)
    this.setDataRange(range[0], range[1])
  }
  setDataRangeFromDataDeep(data: number[][]) {
    let dataFlat = ([] as number[]).concat(...data)
    let range = d3.extent(dataFlat)
    this.setDataRange(range[0], range[1])
  }
  setDataRangeFromLength(data: number[]) {
    this.setDataRange(1, data.length)
  }
  setDataRangeFromLengthDeep(data: number[][]) {
    let lengths = data.map(function (subdata: number[]) {
      return subdata.length
    })
    this.setDataRange(1, d3.extent(lengths)[1])
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

  // Lines
  protected _gLines: any
  protected _lines: any[] = []

  constructor(g: any) {
    this._g = g
    this._gLines = g.append('g')
      .attr('class', 'lines')
    this._yAxis = new YAxis(g)
    this._xAxis = new XAxis(g)
    this._updateChartSize()
    this._updateAxes()
  }

  get yAxis() { return this._yAxis }
  get xAxis() { return this._xAxis }

  set size(size: Size) {
    this._size = size
    this._updateAxes()
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

  private _updateAxes() {
    this._yAxis.chartSize = this._size
    this._xAxis.chartSize = this._size
  }

  updateGroupSize() {

  }

  configure() {

  }

  addLengthLine(yValues: number[], color: string = 'red') {
    // Create the line rules
    let xMult = this._xAxis.multiplier
    let yMult = this._yAxis.multiplier
    let xDomain = this._xAxis.domain
    let yDomain = this._yAxis.domain
    let lineFunc = d3.line()
      .x(function(_: any, idx: number) {
        return xDomain(xMult * idx + 1)
      })
      .y(function(d: any, _: number) {
        return yDomain(yMult * d)
      })

    // Add the line and return it
    let line = this._gLines.append("path")
      .datum(yValues)
      .attr("fill", "none")
      .attr("stroke", color)
      .attr("stroke-linejoin", "round")
      .attr("stroke-linecap", "round")
      .attr("stroke-width", 1.5)
      .attr("d", lineFunc);
    this._lines.push(line)
    return line
  }

}




// Applies exponentially weighted moving average to the data.
function applyEwma(data: number[], beta: number) {
    var ewma = data[0]
    data.forEach(function(value, idx) {
        ewma = value * beta + ewma * (1 - beta)
        data[idx] = ewma
    })
    return data
}






class DataCollector {

  async getRunField(group: string, run: number, compression: number, field: string) {
    return fetch('data/run_field?group=' + group
                 + '&run=' + run
                 + '&compression=' + compression
                 + '&field=' + field)
        .then(function(response) { return response.json(); })
        .then(function(values) {
            return {
                group: group,
                run: run,
                compression: compression,
                field: field,
                value: values
            }
        })
  }


  async getAllRunFields(group: string, run_id: number, compression: number, field: string) {
    let promises = []
    for (run_id = 1; run_id <= RUNS_PER_GROUP; run_id++) {
      promises.push(this.getRunField(group, run_id, compression, field))
    }
    return Promise.all(promises)
  }

  async getAllGroupsField(groups: string[], compression: number, field: string) {
    let promises = []
    for (let group_id in groups) {
      let group = groups[group_id]
      for (let run_id = 1; run_id <= RUNS_PER_GROUP; run_id++) {
        promises.push(this.getRunField(group, run_id, compression, field))
      }
    }
    return Promise.all(promises)
  }

}







// "Main" - run on bootup

let data = new DataCollector()
let graph = new LineGraph(d3.select('#rewards-chart'))
data.getAllGroupsField(['blocks', 'deeplab'], DATA_COMPRESSION, 'rewards')
  .then(function(group_list) {
    return group_list.map(function (group: any) {
      group['color'] = GROUP_COLORS[group['group']]
      group['value'] = applyEwma(group['value'], EWMA_BETA)
      group['formatl_name'] = FORMAL_NAME[group['group']]
      return group
    })
  })
  .then(function(group_list) {
    let group_data: number[][] = group_list.map(function(group: any) { return group['value'] })
    graph.xAxis.multiplier = DATA_COMPRESSION
    graph.yAxis.setDataRangeFromDataDeep(group_data)
    graph.xAxis.setDataRangeFromLengthDeep(group_data)
    for (let groupKey in group_data) {
      let group: any = group_list[groupKey]
      graph.addLengthLine(group['value'], group['color'])
    }
  })
