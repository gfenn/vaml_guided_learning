run_api = 'data/run?id=1'
episode_api ='data/episode?run_id=1&id=1'
episode_api_tmp ='data/episode?run_id=1&id='

REDUCTION_FREQUENCY = 1000
EWMA_BETA = 0.01

document.addEventListener("DOMContentLoaded", function(event) {
    all_runs = []
    for (run = 1; run <= 3; run++) {
        all_runs.push(
            getRunData(run)
                .then(function(data) { return reduceDataCount(data, REDUCTION_FREQUENCY) })
                .then(function(data) { return applyEwma(data, EWMA_BETA) })
        )
    }
    Promise.all(all_runs)
        .then(function(data) { drawChart(data, REDUCTION_FREQUENCY); })
});

function getRunData(run) {
    return fetch('data/run?id=' + run)
        .then(function(response) { return response.json(); })
        .then(function(metadata) {
            // Collect all episodes
            promises_list = []
            for (episode = 1; episode <= metadata['episodes']; episode++) {
//            for (episode = 1; episode <= 100; episode++) {
                promises_list.push(getEpisodeData(run, episode))
            }
            return Promise.all(promises_list)
        })
        .then(function(data) { return data.flat() })
}

function getEpisodeData(run, episode) {
    return fetch('data/episode?run_id=' + run + '&id=' + episode)
        .then(function(response) { return response.json(); })
        .then(function(data) { return data.steps })
        .then(function(steps) {
            rewards = []
            steps.forEach(function(step) {
                rewards.push(step['reward'])
            })
            return rewards
        })
}

function reduceDataCount(data, frequency) {
    reduced = []
    blockMean = 0
    blockCount = 0
    for (i = 0; i < data.length; i++) {
        blockMean += data[i]
        blockCount += 1
        if (blockCount >= frequency) {
            reduced.push(blockMean / blockCount)
            blockMean = 0
            blockCount = 0
        }
    }
    // Add on remaining data if at least half a bucket
    if (blockCount >= frequency * 0.5) {
        reduced.push(blockMean / blockCount)
    }
    return reduced
}

function applyEwma(data, beta) {
    var ewma = data[0]
    data.forEach(function(reward, idx) {
        ewma = reward * beta + ewma * (1 - beta)
        data[idx] = ewma
    })
    return data
}


function drawChart(all_runs, reduction_frequency) {
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
    y_domain = d3.extent(all_runs.flat())
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
    x_domain = [1, d3.extent(all_runs.map(function(run) { return run.length; }))[1] * 1000]
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
        .text("Step");

    // Establish the line rules
    var line = d3.line()
        .x(function(d, idx) {
            return x(reduction_frequency * idx + 1)
        })
        .y(function(d, idx) {
            return y(d)
        })

    // Iterate each run
    all_runs.forEach(function (run_data) {
        g.append("path")
            .datum(run_data)
            .attr("fill", "none")
            .attr("stroke", "green")
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("stroke-width", 1.5)
            .attr("d", line);
    })
}

