
DATA_COMPRESSION = 1000
EWMA_BETA = 0.01
RUNS_PER_GROUP = 3

GROUP_COLORS = {
    'blocks': 'red',
    'deeplab': 'lightgreen'
}

FORMAL_NAME = {
    'blocks': 'Blocks',
    'deeplab': 'Deeplab'
}

document.addEventListener("DOMContentLoaded", function(event) {
    groups = ['blocks', 'deeplab']
//    promises = []
//    getAllGroupsField(groups, DATA_COMPRESSION, 'rewards', promises)
//    Promise.all(promises)
//        .then(function(group_list) {
//            return group_list.map(function (group) {
//                group['color'] = GROUP_COLORS[group['group']]
//                group['value'] = applyEwma(group['value'], EWMA_BETA)
//                group['formal_name'] = FORMAL_NAME[group['group']]
//                return group
//            })
//        })
//        .then(function(group_list) {
//            drawChart(group_list, DATA_COMPRESSION)
//        })

    fetch('data/group_metrics?group=' + groups[0] + '&compression=' + DATA_COMPRESSION)
        .then(function(response) { return response.json(); })
        .then(function(values) {
            console.log("woohoo!")
        })
});

function getRunField(group, run, compression, field) {
    return fetch('data/run_field?group=' + group + '&run=' + run + '&compression=' + compression + '&field=' + field)
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

function getAllRunFields(group, run_id, compression, field, promises) {
    for (run_id = 1; run_id <= RUNS_PER_GROUP; run_id++) {
        promises.push(getRunField(group, run_id, compression, field))
    }
}

function getAllGroupsField(groups, compression, field, promises) {
    for (idx = 0; idx < groups.length; idx ++) {
        group = groups[idx]
        for (run_id = 1; run_id <= RUNS_PER_GROUP; run_id++) {
            promises.push(getRunField(group, run_id, compression, field))
        }
    }
}

function applyEwma(data, beta) {
    var ewma = data[0]
    data.forEach(function(reward, idx) {
        ewma = reward * beta + ewma * (1 - beta)
        data[idx] = ewma
    })
    return data
}


function drawChart(group_list, reduction_frequency) {
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
    var x = d3.scaleLinear().rangeRound([0, width]);
    var y = d3.scaleLinear().rangeRound([height, 0]);

    // Set up the Y axis
    y_domain = d3.extent(group_list.map(function(group) { return group['value'] }).flat())
    y.domain(y_domain);
    g.append("g")
        .call(d3.axisLeft(y))
        .append("text")
        .attr("fill", "#000")
        .attr('font-size', '14px')
        .attr("transform", "rotate(-90)")
        .attr("x", -height/2)
        .attr('y', -35)
        .attr("text-anchor", "middle")
        .text("Step Reward");

    // Set up the X axis
    group_step_counts = group_list.map(function(group) { return group['value'].length; })
    x_domain = [1, d3.extent(group_step_counts)[1] * reduction_frequency]
    x.domain(x_domain);
    g.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).ticks(4))
        .append("text")
        .attr("fill", "#000")
        .attr('font-size', '14px')
        .attr('x', width / 2)
        .attr("y", 36)
        .attr("text-anchor", "middle")
        .text("Training Step");

    // Establish the line rules
    var line = d3.line()
        .x(function(d, idx) {
            return x(reduction_frequency * idx + 1)
        })
        .y(function(d, idx) {
            return y(d)
        })

    // Iterate each group
    group_list.forEach(function (group) {
        g.append("path")
            .datum(group['value'])
            .attr("fill", "none")
            .attr("stroke", group['color'])
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 1.5)
            .attr("d", line);
    })

    // Build the legend
    legend_size = { width: 80, height: 30}
    legend = svg.append('g')
        .attr("transform", "translate(" + (svgWidth - legend_size.width - margin.right)
            + "," + (svgHeight - legend_size.height - margin.bottom - 10) + ")")

    // Items within the legend
    known_groups = {}
    known_counter = 0
    group_list.forEach(function (group) {
        // See if this group has been added to the legend yet
        group_name = group['group']
        if (known_groups[group_name] == null) {
            known_groups[group_name] = true
            known_counter ++

            // Add the line w/ color
            y_base = 16 * (known_counter-1)
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

