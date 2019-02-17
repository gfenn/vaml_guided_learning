
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

class LineGraph {

  // Group that this line graph belongs to
  g: any;
  width: 600;
  height: 400;

  // Data points are compressed, so we need to expand them back
  // out when determining the domain
  xCompression: number = 1000

  lineRules: any;

  constructor(g: any) {
    this.g = g
    this._redefineLineRules()
  }

  _redefineLineRules() {
    let x = d3.scaleLinear().rangeRound([0, this.width]);
    let y = d3.scaleLinear().rangeRound([this.height, 0]);
    let xcomp = this.xCompression
    this.lineRules = d3.line()
        .x(function(_: any, idx: number) {
            return x(xcomp * idx + 1)
        })
        .y(function(d: any, _: number) {
            return y(d)
        })
  }

  updateGroupSize() {

  }

  configure() {

  }

  addLine(data: number[], color: string) {
      this.g.append("path")
          .datum(data)
          .attr("fill", "none")
          .attr("stroke", color)
          .attr("stroke-linejoin", "round")
          .attr("stroke-linecap", "round")
          .attr("stroke-width", 1.5)
          .attr("d", this.lineRules);

  }

}




class DataCollector {

  async getRunField(group: string, run: number, compression: number, field: string) {
    return fetch('data/run_field?group=' + group
                 + '&run=' + run
                 + '&compression=' + compression
                 + '&field=' + field)
        .then(function(response) { return response.json(); })
  }

}


let data = new DataCollector()
let graph = new LineGraph(d3.select('#rewards-chart'))


data.getRunField('blocks', 1, 1000, 'rewards')
  .then(function (lineData) {
    graph.addLine(lineData,
      'blue'
    )
  })
