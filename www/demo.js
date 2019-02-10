run_api = 'data/run?id=1'
episode_api ='data/episode?run_id=1&id=1'

document.addEventListener("DOMContentLoaded", function(event) {
   fetch(episode_api)
     .then(function(response) { return response.json(); })
     .then(function(data) {
        apply_ewma(data.steps, 'reward', 0.1)
        drawChart(data.steps);
     })
});


function apply_ewma(data, field, beta) {
    var ewma = data[0][field]
    data.forEach(function(z) {
        ewma = z[field] * beta + ewma * (1 - beta)
        z.ewma = ewma
    })
}


function drawChart(data) {
    // Set up shape of SVG
    var svgWidth = 600, svgHeight = 400;
    var margin = { top: 20, right: 20, bottom: 50, left: 50 };
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
    var x = d3.scaleLinear().rangeRound([0, width]);
    var y = d3.scaleLinear().rangeRound([height, 0]);

    var line = d3.line()
        .x(function(d) { return x(d.step)})
        .y(function(d) { return y(d.reward)})
    var line_ewma = d3.line()
        .x(function(d) { return x(d.step)})
        .y(function(d) { return y(d.ewma)})
    x.domain(d3.extent(data, function(d) { return d.step }));
    y.domain(d3.extent(data, function(d) { return d.reward }));

    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x))
        .append("text")
        .attr("fill", "#000")
        .attr('font-size', '14px')
        .attr('x', width / 2)
        .attr("y", 36)
        .attr("text-anchor", "middle")
        .text("Step");

    g.append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("fill", "#000")
        .attr('font-size', '14px')
        .attr("transform", "rotate(-90)")
        .attr("x", -height/2)
        .attr('y', -30)
        .attr("text-anchor", "middle")
        .text("Step Reward");

    g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 1.5)
        .attr("d", line);

    g.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "green")
        .attr("stroke-linejoin", "round")
        .attr("stroke-linecap", "round")
        .attr("stroke-width", 1.5)
        .attr("d", line_ewma);
}

