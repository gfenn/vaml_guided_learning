
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
    // Create the empty graph w/ tags
    createEmptyGraph()


//    groups = ['blocks', 'deeplab']
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

//    fetch('data/group_metrics?group=' + groups[0] + '&compression=' + DATA_COMPRESSION)
//        .then(function(response) { return response.json(); })
//        .then(function(values) {
//            console.log("woohoo!")
//        })
});
