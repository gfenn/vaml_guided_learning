
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

// class Rectangle {
//   left: number;
//   right: number;
//   top: number;
//   bottom: number;
//   constructor(left: number, top: number, right: number, bottom: number) {
//     this.left = left;
//     this.right = right;
//     this.top = top;
//     this.bottom = bottom;
//   }
//
//   width() {
//     return this.right - this.left;
//   }
//
//   height() {
//     return this.top - this.bottom;
//   }
//
// }

class LineGraph {

  // Group that this line graph belongs to
  g: any;
  width: 600;
  height: 400;

  // Data points are compressed, so we need to expand them back
  // out when determining the domain
  xCompression: number = 1000

  // Domains
  xDomain: any
  yDomain: any
  lineRules: any = d3.line()
      .x(function(_: any, idx: number) {
          return this.xDomain(this.xCompression * idx + 1)
      })
      .y(function(d: any, _: number) {
          return this.yDomain(d)
      })

  constructor(g: any) {
    this.g = g
    this.setXdomain(1, 10)
    this.setYdomain(1, 10)
  }

  setXdomain(low: number, high: number) {
      this.xDomain = d3.scaleLinear().rangeRound([0, this.width]);
      this.xDomain.domain([low, high])
  }
  setXdomainAuto(data: number[]) {
    let range = d3.extent(data)
    this.setXdomain(range[0], range[1])
  }
  setXdomainFromLength(data: number[]) {
    this.setXdomain(1, data.length * this.xCompression)
  }
  setXdomainFromLengthDeep(data: number[][]) {
    let lengths = data.map(function (subdata: number[]) {
      return subdata.length
    })
    this.setXdomain(1, d3.extent(lengths)[1] * this.xCompression)
  }

  setYdomain(low: number, high: number) {
    this.yDomain = d3.scaleLinear().rangeRound([this.height, 0]);
    this.yDomain.domain([-0.5, +0.8])
  }
  setYdomainAuto(data: number[]) {
    let range = d3.extent(data)
    this.setYdomain(range[0], range[1])
  }
  setYdomainAutoDeep(data: number[][]) {
    let dataFlat = ([] as number[]).concat(...data)
    let yRange = d3.extent(dataFlat)
    this.setYdomain(yRange[0], yRange[1])
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


  OLDBUILD(group_list: string[], reduction_frequency: number) {
      // Set up shape of SVG
      var svgWidth = 610, svgHeight = 400;
      var margin = { top: 20, right: 30, bottom: 50, left: 50 };
      var width = svgWidth - margin.left - margin.right;
      var height = svgHeight - margin.top - margin.bottom;
      var svg = d3.select('svg')
          .attr("width", svgWidth)
          .attr("height", svgHeight);

      // Create the scales
      var g = svg.append("g")
          .attr("transform",
              "translate(" + margin.left + "," + margin.top + ")"
          );

      g.append("g")
          .call(d3.axisLeft(this.yDomain))
          .append("text")
          .attr("fill", "#000")
          .attr('font-size', '14px')
          .attr("transform", "rotate(-90)")
          .attr("x", -height/2)
          .attr('y', -35)
          .attr("text-anchor", "middle")
          .text("Step Reward");

      g.append("g")
          .attr("transform", "translate(0," + height + ")")
          .call(d3.axisBottom(this.xDomain).ticks(4))
          .append("text")
          .attr("fill", "#000")
          .attr('font-size', '14px')
          .attr('x', width / 2)
          .attr("y", 36)
          .attr("text-anchor", "middle")
          .text("Training Step");


      // // Iterate each group
      // group_list.forEach(function (group: any) {
      //   let datum = line(group['value'])
      //     g.append("path")
      //         .datum(group['value'])
      //         .attr("fill", "none")
      //         .attr("stroke", group['color'])
      //         .attr("stroke-linejoin", "round")
      //         .attr("stroke-linecap", "round")
      //         .attr("stroke-width", 1.5)
      //         .attr("d", line);
      // })

      // Build the legend
      let legend_size = { width: 80, height: 30}
      let legend = svg.append('g')
          .attr("transform", "translate(" + (svgWidth - legend_size.width - margin.right)
              + "," + (svgHeight - legend_size.height - margin.bottom - 10) + ")")

      // Items within the legend
      let known_groups: {[key: string]: any} = {}
      let known_counter = 0
      group_list.forEach(function (group: any) {
          // See if this group has been added to the legend yet
          let group_name = group['group']
          if (known_groups[group_name] == null) {
              known_groups[group_name] = true
              known_counter ++

              // Add the line w/ color
              let y_base = 16 * (known_counter-1)
              legend.append('line')
                  .attr('stroke', group['color'])
                  .attr('stroke-width', '3px')
                  .attr('x1', 0)
                  .attr('x2', 16)
                  .attr('y1', y_base-4)
                  .attr('y2', y_base-4)

              // Add the name to the legend
              legend.append('text')
                  .attr("fill", "#000")
                  .attr('font-size', '12px')
                  .attr('x', 20)
                  .attr("y", y_base)
                  .attr("text-anchor", "left")
                  .text(group['formal_name']);
          }
      })
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
    graph.setXdomainFromLengthDeep(group_data)
    graph.setYdomainAutoDeep(group_data)
    graph.OLDBUILD(group_list, DATA_COMPRESSION)
  })
