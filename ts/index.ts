// Author: Grant Fennessy

// - Constants -
let ALL_RUN_COUNT = 6
let FINISHED_RUN_COUNT = 5
let CURRENT_RUN_ID = 6
let DATA_COMPRESSION_LINES = 1000
let DATA_COMPRESSION_SHAPE = 1000
let DATA_COMPRESSION_PREDICTIONS = 10000
let EWMA_BETA_LINES = 0.03
let EWMA_BETA_SHAPE = 0.03

let NUM_ACTIONS = 40
let THROTTLE_ACTIONS = 8
let STEER_ACTIONS = 5

let STEERING_VALUES = [-0.5, -0.1, 0, 0.1, 0.5]
let THROTTLE_VALUES = [1.0, 0.5, 0.25, 0.1, 0, -0.1, -0.5, -1.0]


// Mock Data
let PREDICTION_MAP_STRAIGHT = ([
  [0.01, 0.05, 0.1, 0.05, 0.01],
  [0.05, 0.1, 0.5, 0.1, 0.05],
  [0.1, 0.4, 0.8, 0.4, 0.1],
  [0.2, 0.6, 1.0, 0.6, 0.2],
  [0.1, 0.4, 0.8, 0.4, 0.1],
  [0.05, 0.2, 0.5, 0.2, 0.05],
  [0.03, 0.1, 0.2, 0.1, 0.03],
  [0.01, 0.05, 0.1, 0.05, 0.01],
] as any).flat()
let PREDICTION_MAP_LEFT = ([
  [0.08, 0.05, 0.03, 0.01, 0.0],
  [0.1, 0.08, 0.05, 0.03, 0.01],
  [0.5, 0.3, 0.1, 0.05, 0.01],
  [0.8, 0.5, 0.3, 0.1, 0.05],
  [1.0, 0.9, 0.5, 0.3, 0.1],
  [0.8, 0.5, 0.3, 0.1, 0.05],
  [0.5, 0.3, 0.1, 0.05, 0.01],
  [0.1, 0.08, 0.05, 0.03, 0.01],
] as any).flat()
let PREDICTION_MAP_RIGHT = ([
  [0.01, 0.03, 0.05, 0.08, 0.1],
  [0.01, 0.05, 0.1, 0.3, 0.5],
  [0.05, 0.1, 0.3, 0.5, 0.8],
  [0.1, 0.3, 0.5, 0.9, 1.0],
  [0.05, 0.1, 0.3, 0.5, 0.8],
  [0.01, 0.05, 0.1, 0.3, 0.5],
  [0.01, 0.03, 0.05, 0.08, 0.1],
  [0.0, 0.01, 0.03, 0.05, 0.08],
] as any).flat()

let PREDICTION_MOCK_DATA = {
  'Straight': PREDICTION_MAP_STRAIGHT,
  'Left': PREDICTION_MAP_LEFT,
  'Right': PREDICTION_MAP_RIGHT
}

// =============================================
// =============================================
// =============================================
// =========== DATA FIELDS =====================
// =============================================
// =============================================
// =============================================

function reduceMax(prev: number, curr: number): number {
  if (prev === undefined) return curr
  return Math.max(prev, curr)
}
function reduceMin(prev: number, curr: number): number {
  if (prev === undefined) return curr
  return Math.min(prev, curr)
}

function linspace(start, end, n) {
  var out = [];
  var delta = (end - start) / (n - 1);

  var i = 0;
  while(i < (n - 1)) {
    out.push(start + (i * delta));
    i++;
  }

  out.push(end);
  return out;
}

// Convert the array into values between [0, 1]
function normalizeValues(values: number[]) {
  // Adjust min so lowest value is 0
  let minVal = values.reduce(reduceMin, undefined)
  values = values.map(val => val - minVal)

  // Divice each by max value so range is 0-1
  let maxVal = values.reduce(reduceMax, undefined)
  values = values.map(val => val / maxVal)
  return values
}

// Generates pseudo-random data to populate the action predictions, including
// applying softmax on the data.
function generateMockPredictionData(sample: string = 'Straight', accuracy: number = 0.8): number[] {
  // Apply accuracy randomness
  let mock = PREDICTION_MOCK_DATA[sample]
    .map(v => {
      if (Math.random() > accuracy) {
        return Math.random() * 2 - 1 + v
      }
      return v
    })
    .map(v => Math.pow(Math.max(v, 0), 1 + Math.abs(accuracy)))

  // Determine softmax
  let total = mock.reduce((p, value) => p + Math.exp(value), 0)
  let softmax = mock.map(v => Math.exp(v) / total)
  return softmax
}

// Generates mock labels, assigning 0 (bad), 1 (neutral) or 2 (good) to each action index.
function generateMockPredictionLabels(sample: string = 'Straight'): number[] {
  return PREDICTION_MOCK_DATA[sample]
    .map(v => {
      if (v <= 0.2) return 0;
      if (v <= 0.6) return 1;
      return 2;
    })
}

// Rounds the value to the given number of significant figures.
function roundToSigFigures(value: number, figures: number): number {
  let e = Math.floor(Math.log(value) / Math.log(10)) + 1
  if (e <= figures) {
    return value
  }
  let reducer = Math.pow(10, e-figures)
  return Math.round(value / reducer) * reducer

}

// Formats the step number to be 3 significant figures + reduced by 1,000s
function formatStep(step: number): string {
  let rounded = roundToSigFigures(step, 3)
  if (rounded < 1000) {
    return rounded + ''
  }
  let roundedK = rounded / 1000
  if (roundedK < 1000) {
    return roundedK + 'k'
  }
  let roundedM = roundedK / 1000
  if (roundedM < 1000) {
    return roundedM + 'M'
  }
  return (roundedM / 1000) + 'G'
}

function determineCurrentPrediction(runPredictions: PredictionsForRun): Prediction {
  let step = Math.floor(SELECTED_STEPS[0] / DATA_COMPRESSION_PREDICTIONS)
  return runPredictions.predictionForStep(step)
}

function determineAveragePrediction(runPredictions: PredictionsForRun, sample: Sample): Prediction {
  // Prediction range
  let predictions = runPredictions.predictionsForRange(
    SELECTED_STEPS.map(it =>
      Math.floor(it / DATA_COMPRESSION_PREDICTIONS))
  )
  if (predictions.length > 0) {
    let avgPrediction = new Prediction(
      normalizeNumberArrays(predictions.map(it => it.data)),
      normalizeNumberArrays(predictions.map(it => it.dataNormalized)),
      predictions.reduce((prev, curr) => prev + curr.correctness, 0) / predictions.length
    )
    return avgPrediction
  }
  return undefined
}

// Interface for a generic data field - field is an identifier for
// exactly which data is being stored (such as rewards data)
class DataFieldI {
  field: string
  constructor(field: string) {
    this.field = field
  }
}

// Simple implementation which uses points to store information.
class DataField extends DataFieldI {
  points: Point[]
  constructor(field: string, points: Point[]) {
    super(field)
    this.points = points
  }

  // Applies exponentially weighted moving average on each of the points,
  // smoothing out the Y values.  Important for results that would otherwise
  // be very jagged.
  applyEwma(beta: number) {
    let ewma = this.points[0].y
    this.points.forEach(function(point: Point) {
        ewma = point.y * beta + ewma * (1 - beta)
        point.y = ewma
    })
  }
}

// Stores a data field for a specific experiment run
class DataRunField extends DataField {
  run_id: number
  constructor(run_id: number, field: string, points: Point[]) {
    super(field, points)
    this.run_id = run_id
  }
}

// Contains fields for multiple runs
class DataAllRunFields extends DataFieldI {
    runs: DataRunField[]
    constructor(runs: DataRunField[]) {
      super(runs[0].field)
      this.runs = runs
    }

    applyEwma(beta: number) {
      for (let run in this.runs) { this.runs[run].applyEwma(beta) }
    }
}

// Holds percentile metrics across all runs for a specific field.
// Used for the curve boxplot of rewards values.
class DataMetrics extends DataFieldI {
  p25: DataField
  p50: DataField
  p75: DataField
  constructor(metrics: any) {
    super('metrics')
    this.p25 = new DataField('p25', metrics['p25'])
    this.p50 = new DataField('p50', metrics['p50'])
    this.p75 = new DataField('p75', metrics['p75'])
  }

  // Apply smoothing to all of the metrics
  applyEwma(beta: number) {
    this.p25.applyEwma(beta)
    this.p50.applyEwma(beta)
    this.p75.applyEwma(beta)
  }

  // Extracts points which represent the shape with the top line of the 25th percentile
  // and the bottom line (in reverse) being the 75th percentile.
  midlineShape(): Point[] {
    let points: Point[] = []
    points.push(...this.p25.points)
    points.push(...this.p75.points.reverse())
    return points
  }
}

// Stores all of the loaded data for the model's predictions at a specific step.
class Prediction {
  // The 0-1 probability of the action being taken -> softmax result
  data: number[]
  // Probabilities normalized so highest probability is 1 and lowest is 0
  dataNormalized: number[]
  // correctness value (0 to 1)
  correctness: number

  static build(data: number[], correctness: number, labels: number[]) {
    // let max = data.reduce((p, v) => v > p ? v : p, data[0])
    // this.dataNormalized = data.map(v => v / max)
    let dataNormalized = normalizeValues(data)

    // // Measure the correctness
    // TODO - when no longer using mock data, determine correctness score
    // let score = data.map((probability, index) => {
    //   // Label is 0 (wrong = 0 points), 1 (neutral = 0.5 points), or 2 (good = 1 point)
    //   return probability * (labels[index] / 2)
    // })
    // correctness = score.reduce((p, c) => p + c, 0)
    return new Prediction(data, dataNormalized, correctness)
  }

  constructor(data: number[], dataNormalized: number[], correctness: number) {
    this.data = data
    this.dataNormalized = dataNormalized
    this.correctness = correctness
  }
}

// The name of a sample, along with its user-defined labels (bad, neutral, or good)
class Sample {
  name: string
  labels: number[]
  constructor(name: string, labels: number[] = generateMockPredictionLabels()) {
    this.name = name
    this.labels = labels
  }
}

// For a given run, stores all of the predictions that took place.
class PredictionsForRun {
  sample: Sample
  run: number
  predictions: Prediction[]
  constructor(sample: Sample, run: number, predictions: Prediction[]) {
    this.sample = sample
    this.run = run
    this.predictions = predictions
  }
  predictionForStep(step: number) {
    let last = this.predictions.length - 1
    return this.predictions[Math.min(step, last)]
  }
  predictionsForRange(steps: number[]) {
    let last = this.predictions.length - 1
    let s0 = Math.min(steps[0], last)
    let s1 = Math.min(steps[1], last)
    if (s0 > s1) {
      let tmp = s0; s0 = s1; s1 = tmp;
    }
    return this.predictions.slice(s0, s1 + 1)
  }
}

// Stores all of the runs worth for a given sample.
class PredictionsAllRuns {
  sample: Sample
  runs: PredictionsForRun[]
  constructor(sample: Sample, runs: PredictionsForRun[]) {
    this.sample = sample
    this.runs = runs
  }
}

// Stores all sample data for all runs, queriable based on sample.  Also stores
// a unique list of samples.
class SampleDataRepo {
  map: {[key: string]: PredictionsAllRuns} = {}
  samples: Sample[] = []
  data: PredictionsAllRuns[] = []
  constructor(data: PredictionsAllRuns[]) {
    data.forEach(d => {
      this.map[d.sample.name] = d
      this.samples.push(d.sample)
    })
    this.data = data
  }
}

class EventMetadata {
  learningRate: number
  explorationRate: number
  rewardShift: number
  step: number
  constructor(learningRate: number, explorationRate: number, rewardShift: number, step: number) {
    this.learningRate = learningRate
    this.explorationRate = explorationRate
    this.rewardShift = rewardShift
    this.step = step
  }
}

class EpisodeEvent {
  step: number
  name: string
  id: string
  metadata: EventMetadata
  constructor(step: number, name: string, metadata: EventMetadata) {
    this.step = step
    this.name = name
    this.id = name.replace(/\s+/g, '')
    this.metadata = metadata
  }
}

// Class with several useful methods for collecting data from the server
// by way of promises.  All server API calls take place here, and properly
// formatted data is returned.
class DataCollector {

  // Converts an array of numbers into points, where the index is stored in the X value
  private _arrayToPoints(values: number[], compression: number): Point[] {
    let points: Point[] = []
    values.forEach((value, index) =>
      points.push(new Point((index + 1) * compression, value)))
    return points
  }

  // For a given run, loads all values in the provided field
  // (such as rewards).  Data is then compressed, where steps are bucketized
  // by mean so as to reduce data requirements with millions of steps.
  async getRunField(run: number, compression: number, field: string): Promise<DataRunField> {
    let atp = this._arrayToPoints
    return fetch('data/run_field?run=' + run
                 + '&compression=' + compression
                 + '&field=' + field)
        .then(response => response.json() )
        .then(function(values) {
          return atp(values, compression)
        })
        .then(function(points) {
          return new DataRunField(run, field, points)
        })
  }

  // Returns the individual run data for all runs
  async getAllRunFields(compression: number, field: string): Promise<DataAllRunFields> {
    let promises = []
    console.error("Need to determine number of runs")
    // TODO - query to get number of groups
    for (let run_id = 1; run_id <= ALL_RUN_COUNT; run_id++) {
      promises.push(this.getRunField(run_id, compression, field))
    }
    return Promise.all(promises)
      .then(function(all_runs: DataRunField[]) {
        return new DataAllRunFields(all_runs)
      })
  }

  async resetCurrent(): Promise<void> {
    return fetch('data/reset')
      .then(function(response) { return response.json(); })
  }

  // Returns metrics, which includes rewards percentiles.
  async getMetrics(compression: number): Promise<DataMetrics> {
    let atp = this._arrayToPoints
    return fetch('data/metrics?compression=' + compression)
        .then(function(response) { return response.json(); })
        .then(function(metrics) {
          let data: any = {}
          for (let key in metrics) {
            data[key] = atp(metrics[key], compression)
          }
          return data
        })
        .then(function(metrics) {
          return new DataMetrics(metrics)
        })
  }

  // Returns a list of all use-annotated samples
  async getAllSamples(): Promise<Sample[]> {
    // TODO -> have samples stored and return them with ththis query
    let samples = ["Straight", "Left", "Right"].map(sample => {
      return new Sample(sample, generateMockPredictionLabels(sample))
    })
    return Promise.resolve(samples)
    // return fetch('data/all_samples')
    //     .then(function(response) { return response.json(); })
  }

  // Returns the entire set of predictions for a sample within a run.
  // Basically, how well did this experiment within the batch handle the given sample over training?
  // TODO - needs to eventually be something where you pass in specific runs
  async getPredictionsForRun(
    run_id: number,
    sample: Sample,
    compression: number
  ): Promise<PredictionsForRun> {
    // TODO - SINCE THIS IS MOCK
    return this.getRunField(run_id, compression, 'rewards')
      .then(data => {
        let values = normalizeValues(data.points.map(p => p.y))
        let steps = values.map(v => {
          let mockData: number[] = generateMockPredictionData(sample.name, v + 0.1)
          return Prediction.build(mockData, v, sample.labels)
        })

        return new PredictionsForRun(sample, run_id, steps)
      })
  }

  // Returns predictions for all runs.
  async getSamplePredictionsAllRuns(
    sample: Sample,
    compression: number
  ): Promise<PredictionsAllRuns> {
    let promises: Promise<PredictionsForRun>[] = []
    for (let run_id = 1; run_id <= ALL_RUN_COUNT; run_id++) {
      promises.push(this.getPredictionsForRun(run_id, sample, compression))
    }
    return Promise.all(promises)
      .then(values => {
        let filtered = values.filter(it => {
          return it.predictions.length > 0
        })
        return new PredictionsAllRuns(sample, filtered)
      })
  }

  // Within an experiment group, returns data for all runs against all samples
  async getSampleDataRepo(
    compression: number
  ): Promise<SampleDataRepo> {
    return this.getAllSamples().then(samples => {
      let promises: Promise<PredictionsAllRuns>[] = []
      samples.forEach(sample => {
        promises.push(this.getSamplePredictionsAllRuns(sample, compression))
      })
      return Promise
        .all(promises)
        .then(values => {
          let filtered = values.filter(it => {
            return it.runs.length > 0
          })
          return new SampleDataRepo(filtered)
        })
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

// A simple rectangle object
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

// A simple point object for x and y position.
class Point {
  x: number
  y: number
  constructor(x: number, y: number) {
    this.x = x;
    this.y = y
  }
}

// A simple size object for width and height
class Size {
  width: number
  height: number
  constructor(width: number, height: number) {
    this.width = width;
    this.height = height
  }
}

// A simple shape to place within an SVG.  The type o fshape is not defined,
// but it rests within a parent, has an X and Y axis available for scaling,
// the data from the value domain into the pixel domain on the graph.
// Keeps a bounding box up to date which wraps all contained data in the
// value domain (not the pixel domain).
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

// A graph shape that exists by way of a collection of points.  Since the points
// define location, they can be used to automatically construct the bounding box.
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
    return this._points.map(p => p.x)
  }
  get yValues(): number[] {
    return this._points.map(p => p.y)
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

// A simple line object, which connects a series of points.
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

// A polygon object, which is a collection of points that defines the outline
// of a polygonal shape.
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

// Objects that exist within a rectangle.
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

// A simple box/rectangle object.
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
// An X or Y axis for a graph.  Stores all info for converting data from
// the value domain into the pixel domain (or in reverse).
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

// Y axis implementation.
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

// X axis implementation
class XAxis extends LineGraphAxis {

  private _top: boolean = false

  set top(top: boolean) {
    this._top = top
    this._rebuildDomain()
    this._chartSizeUpdated()
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
// An SVG region in which shapes can be placed.  Has an X and Y axis,
// and automatically updates the graph internal size based on the bounding
// box generated from all stored shapes.  A padding exists which automatically
// adds a percentile buffer to the discovered bounding box size.
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

  // Iterates all shapes to generates a bounding box that contains all of them.
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

  // Updates all of the axes by rebuilding the bounding box, then setting the
  // box range into the X and Y axes to update the domain conversion.  Each
  // shape is then rebuilt so that it is positioned properly within the chart.
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

  // Adds a line shape that is automatically positioned.
  addLine(points: Point[], color: string = 'red') {
    let line = new Line(this._gShapes, this._xAxis, this._yAxis, points)
    line.g.attr('stroke', color)
    this._shapes.push(line)
    this.updateAxes()
    return line
  }

  // Adds a box shape that is automatically positioned.
  addBox(rectangle: Rectangle, fill: string = 'lightgray', stroke: string = 'black') {
    let box = new Box(this._gShapes, this._xAxis, this._yAxis, rectangle)
    box.g.attr('fill', fill)
      .attr('stroke', stroke)
    this._shapes.push(box)
    this.updateAxes()
    return box
  }

  // Adds a polygon shape that is automatically positioned.
  addPolygon(points: Point[], fill: string = 'lightblue', stroke: string = 'blue') {
    let polygon = new Polygon(this._gShapes, this._xAxis, this._yAxis, points)
    polygon.g.attr('fill', fill)
    polygon.g.attr('stroke', stroke)
    this._shapes.push(polygon)
    this.updateAxes()
    return polygon
  }

  // Removes a shape and udpates the chart size.
  removeShape(shape: any) {
    this._shapes = this._shapes.filter(function(s: GraphShape) {
      return s != shape
    })
    this.updateAxes()
  }

}








const CURVE_BOXPLOT_FILL = '#ffffff'
const CURVE_BOXPLOT_LINE = 'lightgray'

//  The rewards graph is a specific implementation of the ShapeRegion which
// has all of the necessary components for the current run reward line, the
// curve boxplot with metrics, the current selection line, and all interactive
// components.
class RewardsGraph extends ShapeRegion {

  private _curveBoxplotShape: Polygon
  private _curveBoxplotCenterline: Line
  private _runLines: Line[] = []
  private _selectedEvent: string = null

  private _backgroundG: any
  private _selectionG_Range: any // Used for range
  private _selectionG_1: any
  private _selectionG_2: any // Used for range
  private _eventsG: any

  constructor() {
    super(d3.select('#rewards-chart'))
    this._boundingPadding.bottom = 0.1

    // Add background, which has a slight color offset to make the white
    // curve boxplot shape pop and to make the chart boundaries clear.
    let self = this
    this._backgroundG = this.g.insert('g', 'g').attr('class', 'background')
    this._backgroundG.append('rect')
      .attr('width', this.size.width)
      .attr('height', this.size.height)
      .attr('fill', '#fbfbfb')
      .attr('stroke', 'lightgray')

    // The selection line goes on the background - might need to move this forward.
    this._selectionG_Range = this._backgroundG
      .append('rect')
      .attr('class', 'rangeBG')
      .attr('width', '0')
      .attr('height', this.size.height)
      .attr('visibility', 'hidden')
    this._selectionG_1 = this.buildSelectionLine(true)
    this._selectionG_2 = this.buildSelectionLine(false)
    this._selectionG_2.attr('visibility', 'hidden')

    this._eventsG = this._backgroundG
      .append('g')
      .attr('class', 'events')

    // Add foreground, which is invisible but listens for mouse clicks.
    this.g.append('rect')
      .attr('width', this.size.width)
      .attr('height', this.size.height)
      .attr('fill', 'rgba(0,0,0,0)')
      .on('mousedown', function() {
        let coords = d3.mouse(this)
        let step = self._xAxis.domain.invert(coords[0])
        if (d3.event.shiftKey)
          setSelectionRange(SELECTED_STEPS[0], step)
        else
          setSelectedStep(Math.round(step))
        REWARDS_GRAPH.deselectEvents()
      })
      .call(d3.drag().on('start', function() {
        d3.event.on('drag', function(d) {
          let coords = d3.mouse(this)
          let step = self._xAxis.domain.invert(coords[0])
          if (step >= 0 && step <= 3000000) {
            setSelectionRange(SELECTED_STEPS[0], step)
          }
        })
      }))


    // Add a polygon and hide it
    this._curveBoxplotShape = this.buildCurveBoxplotShape()
    this._curveBoxplotCenterline = this.buildCurveBoxplotCenterline()

    // Put the X axis on top
    this._xAxis.top = true
  }

  private selectionBarY(bar: any, override: boolean = undefined): number {
    if ((bar == this._selectionG_1 && override !== false) || override === true)
      return this.size.height - 4
    return 12
  }

  private buildSelectionLine(bottom: boolean): any {
    // Create g
    let selectionG = this._backgroundG
      .append('g')
      .attr('class', 'selection')

    // Add line
    selectionG
      .append('line')
      .attr('class', 'selectionLine')
      .attr('y2', this.size.height)

    // Add text
    let y = this.selectionBarY(undefined, bottom)
    selectionG
      .append('text')
      .attr('class', 'selectionText')
      .attr('transform', 'translate(2, ' + y + ')')
      .text('Step: 0')

    return selectionG
  }

  // Builds a curve boxplot shape with filler data, then hides it.  Pre-building
  // makes sure that it's placed in the correct order behind the line.
  private buildCurveBoxplotShape(): Polygon {
    let shape = this.addPolygon([new Point(0, 0), new Point(0, 1), new Point (1, 0)])
    shape.g
      .attr('fill', CURVE_BOXPLOT_FILL)
      .attr('stroke', CURVE_BOXPLOT_LINE)
    shape.hide()
    return shape
  }

  // Builds a fake centerline, then hides it so that ordering is set up correctly.
  private buildCurveBoxplotCenterline(): Line {
    let line = this.addLine([new Point(0, 0), new Point(1, 1)], CURVE_BOXPLOT_LINE)
    line.hide()
    return line
  }

  // Selects a step, updating the selection line and text.
  selectStep(step: number) {
    let x = this._xAxis.domain(step)
    this.positionSelectionBar(step, x, this._selectionG_1)
    this._selectionG_2.attr('visibility', 'hidden')
    this._selectionG_Range.attr('visibility', 'hidden')
  }

  selectStepRange(range: number[]) {
    // Out of order?
    let r0 = range[0]
    let r1 = range[1]
    if (r0 > r1) {
      r0 = range[1]
      r1 = range[0]
    }

    // Position bars
    let x0 = this._xAxis.domain(r0)
    let x1 = this._xAxis.domain(r1)

    // Store
    this.positionSelectionBar(r0, x0, this._selectionG_1)
    this.positionSelectionBar(r1, x1, this._selectionG_2)

    // Position background
    this._selectionG_Range
      .attr('x', x0)
      .attr('width', x1 - x0)

    // Enabled visibility
    this._selectionG_2.attr('visibility', 'visible')
    this._selectionG_Range.attr('visibility', 'visible')
  }

  private positionSelectionBar(step: number, x: number, selectionG: any) {
    // Update position
    selectionG.attr('transform', 'translate(' + x + ', 0)')

    let transformX
    let anchor
    if (x >= this.size.width / 2) {
      transformX = -3
      anchor = 'end'
    }
    else {
      transformX = 3
      anchor = 'begin'
    }
    let y = this.selectionBarY(selectionG)
    selectionG.select('text')
      .attr('transform', 'translate(' + transformX + ', ' + y + ')')
      .attr('text-anchor', anchor)
      .text('Step: ' + formatStep(step))
  }

  // Loads all of the metrics data
  loadCurveBoxplotData() {
    return DATA.getMetrics(DATA_COMPRESSION_SHAPE)
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

  // Loads all of the run lines.  NOTE - Right now it's
  // actually just loading the first run.  Later this should be updated
  // to show the current run
  loadRunLine() {
    // Add lines
    DATA.getRunField(CURRENT_RUN_ID, DATA_COMPRESSION_LINES, 'rewards')
      .then(runData => {
        // Empty?
        if (runData.points.length == 0) return

        // Apply
        runData.applyEwma(EWMA_BETA_LINES)
        if (this._runLines.length == 0) {
          let line = this.addLine(runData.points, 'red')
          line.g.attr('class', 'runLine')
          this._runLines.push(line)
        }
        else {
          this._runLines[0].points = runData.points
          this._runLines[0].rebuild()
        }
      })
      .then(() => {
        // If automatic selection, select last step
        if (!IS_MANUAL_SELECTION) {
          setSelectedStep(-1, false)
          REWARDS_GRAPH.deselectEvents()
        }
      })
  }

  runLine() {
    if (this._runLines.length > 0) {
      return this._runLines[this._runLines.length - 1]
    }
    return undefined
  }

  lastStep() {
    if (this._runLines.length > 0) {
      return this._runLines[0].points.length * DATA_COMPRESSION_LINES
    }
    return 0
  }

  addEvent(event: EpisodeEvent) {
    // Create event group w/ transform
    let eventG = this._eventsG
      .append('g')
      .attr('id', event.id)
      .attr('class', 'event')
      .attr('transform', 'translate(' + this._xAxis.domain(event.step) + ', 0)')

    // Line is simple
    let FLAG_OVERSHOT = 6
    eventG.append('line')
      .attr('class', 'eventLine')
      .attr('y2', this.size.height + FLAG_OVERSHOT)

    // Now need flag shape underneath line
    let pointsFunc = function(data: Point[]) {
      return data.map(function(point: Point) {
        return [point.x, point.y].join(",")
      }).join(" ")
    }
    let yBase = this.size.height + FLAG_OVERSHOT
    let flagHeight = 18
    let flagPoints = [
      new Point(0, yBase),
      new Point(40, yBase),
      new Point(50, yBase + flagHeight/2),
      new Point(40, yBase + flagHeight),
      new Point(0, yBase + flagHeight)
    ]
    eventG.append('polygon')
      .attr('class', 'eventFlag')
      .datum(flagPoints)
      .attr('points', pointsFunc)
      .on('mousedown', () => {
        this.selectEvent(event)
      })

    // Add the text
    eventG.append('text')
      .attr('class', 'eventText')
      .attr('x', 3)
      .attr('y', yBase + flagHeight/2 + 3)
      .text(event.name);

    // Select
    this.selectEvent(event)
  }

  selectEvent(event: EpisodeEvent) {
    this._eventsG.selectAll('g').attr('class', 'event')
    if (event.name == this._selectedEvent) {
      this._selectedEvent = null
      setSelectedStep(-1, false)
    }
    else {
      this._selectedEvent = event.name
      this._eventsG.selectAll('#' + event.id).attr('class', 'event selected')

      if (d3.event != null && d3.event.shiftKey)
        setSelectionRange(SELECTED_STEPS[0], event.step)
      else
        setSelectedStep(event.step, true)
    }

    reversePopulateEventMetadata(event.metadata)
  }

  deselectEvents() {
    this._selectedEvent = null
    this._eventsG.selectAll('g').attr('class', 'event')
  }

  clearEvents() {
    this._eventsG
      .selectAll('g')
      .remove()
  }

}













// ===================================================
// ===================================================
// ===================================================
// =========== SPECTROGRAM ===========================
// ===================================================
// ===================================================
// ===================================================
// A simple container for an SVGGelement which presumably
// has a shape or some useful object within it.
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

// A spectrogram row is an SVGGElement which contains a small rectangle for
// each cell within the row along the x-channel.  Cells are colored based
// on their measured values (between 0 and 1).
class SpectrogramRow extends SimpleG {

  values: number[] = []
  xDomain: any

  constructor(g: SVGGElement, width: number, height: number, xDomain: any) {
    super(g, width, height)
    this.xDomain = xDomain
  }

  private rebuild(values: number[]) {
    this.gSelection
      .selectAll('rect')
      .remove()

    // Create the boxes
    this.gSelection
      .selectAll('rect')
      .data(values)
      .enter()
      .append('rect')
      .attr('x', (d, i) => this.xDomain(i))
      .attr('y', 0)
      .attr('width', this.xDomain(1))
      .attr('height', this.height)
  }

  checkRebuild(values: number[]) {
    if (values.length != this.values.length) {
      this.rebuild(values)
    }
  }

  data(steps: Prediction[]) {
    // Map
    let values = steps.map(s => s.correctness)

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

// A single spectrogram, which has multiple rows (one for each run)
class Spectrogram extends SimpleG {

  sample: Sample
  label: any
  rows: SpectrogramRow[] = []
  background: any
  xDomain: any
  predictions: PredictionMatrix

  private _data: PredictionsForRun[]

  constructor(g: SVGGElement, width: number, height: number, sample: Sample) {
    super(g, width, height)
    this.sample = sample

    // Determine x domain
    this.xDomain = d3.scaleLinear()
      .domain([0, 1])
      .range([0, this.width])

    let self = this
    this.gSelection.on('mousedown', function() {
      // Select the sample
      self.select()

      // Update the step
      let coords = d3.mouse(this)
      if (coords[0] > 0 && coords[0] <= self.width) {
        let step = self.xDomain.invert(coords[0]) * DATA_COMPRESSION_PREDICTIONS
        setSelectedStep(Math.round(step))
        REWARDS_GRAPH.deselectEvents()
      }
    })

    this.label = this.gSelection
      .append('text')
      .attr("fill", "#000")
      .attr('font-size', '10px')
      .attr('x', -5)
      .attr('y', height/2 +3)
      .attr("text-anchor", "end")
      .text("label");

    // Create a background rectangle
    this.background = this.gSelection.append('rect')
      .attr('width', this.width)
      .attr('height', this.height)
      .attr('class', 'spectrogramBackground')

    // Prediction matrix
    let predictionG = this.gSelection
      .append('g')
      .attr('class', 'predictionMatrix')
      .attr('transform', 'translate(' + (this.width + 10) + ', 0)')
    this.predictions = new PredictionMatrix(predictionG, new Size(height, height), true)
  }

  select() {
    setSelectedSample(this.sample.name)
    d3.selectAll('.spectrogramBackground').attr('class', 'spectrogramBackground')
    this.background.attr('class', 'spectrogramBackground selected')
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
      this.rows.push(new SpectrogramRow(rowG, this.width, rowHeight, this.xDomain))
    }
  }

  checkRebuild(numRows: number) {
      if (numRows != this.rows.length) {
        this.rebuild(numRows)
      }
  }

  data(rows: PredictionsForRun[]) {
    // Check for a rebuild
    this.checkRebuild(rows.length)
    let maxLength = rows
      .map(r => r.predictions.length)
      .reduce(reduceMax, undefined)

    this.xDomain.domain([0, maxLength])

    // Set the datavalues
    rows.forEach((row, index) => {
      this.rows[index].data(row.predictions)
    })
    this._data = rows
    this.updatePredictions()
  }

  updatePredictions() {
    // Update the prediction matrix
    if (this._data && this._data.length > 0) {
      let currentRun = this._data[this._data.length - 1]
      if (SELECTED_STEPS.length == 1) {
        let prediction = determineCurrentPrediction(currentRun)
        this.predictions.data(prediction, currentRun.sample)
      }
      else if (SELECTED_STEPS.length == 2) {
        let prediction = determineAveragePrediction(currentRun, currentRun.sample)
        if (prediction) {
          this.predictions.data(prediction, currentRun.sample)
        }
      }
    }
  }

  set text (text: string) {
    this.label.text(text)
  }

}

// Contains all of the set of spectrograms (one per sample)
class SpectrogramsArea extends SimpleG {

  samples: Sample[] = []
  spectrogramsMap: {[key: string]: Spectrogram} = {}

  constructor() {
    super(d3.select('#spectrograms').node() as any, 600, 150)
  }

  private rebuild(samples: Sample[]) {
    // Determine the band size for the spectrograms
    this.samples = samples
    let spectrogram_vertical_band = d3.scaleBand()
      .domain(samples.map(s => s.name))
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
      .attr('transform', d => 'translate(0, ' + spectrogram_vertical_band(d.name) + ')')
      .attr('height', spectrogram_vertical_band.bandwidth())
      .attr('class', 'spectrogram')
      .nodes()
      .forEach(node => {
        let data: Sample = d3.select(node).datum() as Sample
        let spectrogram = new Spectrogram(node, this.width, spectrogram_vertical_band.bandwidth(), data)
        this.spectrogramsMap[data.name] = spectrogram
      })
  }

  checkRebuild(samples: Sample[]) {
    if (samples.length != this.samples.length) {
      this.rebuild(samples)
    }
  }

  data(data: SampleDataRepo) {
    // Check for a rebuild (make a unique set of samples)
    this.checkRebuild(data.samples)

    // Populate the data
    data.data.forEach(d => {
      let s = this.spectrogramsMap[d.sample.name]
      s.data(d.runs)
      s.text = d.sample.name
    })
  }

  updatePredictions() {
    for (let key in this.spectrogramsMap) {
      this.spectrogramsMap[key].updatePredictions()
    }
  }

}



// =======================================================
// =======================================================
// =======================================================
// =========== CONFUSIONMATRIX ===========================
// =======================================================
// =======================================================
// =======================================================

// Handles the text to the right of the prediction matrix which
// shows up while hovering over grid cells.
class HoverText {
  g: any
  valueText: any
  throttleText: any
  steerText: any
  constructor(g: any) {
    this.g = g
    this.valueText = g
      .append('text')
      .attr('y', -12)
      .attr('font-size', 10)
      .text('Value')

    this.throttleText = g
      .append('text')
      .attr('font-size', 10)
      .text('Throttle')

    this.steerText = g
      .append('text')
      .attr('y', 12)
      .attr('font-size', 10)
      .text('Steering')

    this.hide()
  }

  // Displays the prediction matrix values
  show(value: number, throttle: number, steering: number) {
    this.valueText.text('Value: ' + value + '%')
    this.throttleText.text('Throttle: ' + throttle)
    this.steerText.text('Steer: ' + steering)
    this.g.attr('visibility', 'visible')
  }

  // Hide this group
  hide() {
    this.g.attr('visibility', 'hidden')
  }
}


class PredictionMatrixScale {

  private _bar: any
  private _high: any
  private _low: any

  constructor(g: any, height: number) {
    this._bar = g.append('rect')
      .attr('width', '10')
      .attr('height', height)
      .style('fill', 'url(#predMatrixGradient)')

    this._high = g.append('text')
      .attr('x', '15')
      .attr('y', '9')
      .attr('class', 'predMatrixScaleText')
      .text('1.0')

    this._low = g.append('text')
      .attr('x', '15')
      .attr('y', height)
      .attr('class', 'predMatrixScaleText')
      .text('0.0')
  }

  scale(low: number, high: number) {
    this._high.text(high.toPrecision(2))
    this._low.text(low.toPrecision(2))
  }
}


// Contains all information for the prediction matrix.
class PredictionMatrix extends ShapeRegion {

  squares: Box[] = []
  prediction: Prediction
  sample: Sample
  scale: PredictionMatrixScale
  private _header: any
  private _hoverText: HoverText
  private _monoColors: boolean = true

  constructor(g: any, size: Size = new Size(100, 160), embedded: boolean = false) {
    super(g)
    this.size = size

    // Add header
    if (!embedded) {
      this._header = this.g.append('text')
        .attr('x', this.size.width / 2)
        .attr('y', -8)
        .attr("text-anchor", "middle")
        .text('Sample: None Selected')
    }

    // Add a background
    this.g.insert('rect', 'g')
      .attr('x', -1)
      .attr('y', -1)
      .attr('width', this.size.width + 2)
      .attr('height', this.size.height + 2)

    if (!embedded) {
      // Build the hover component and place it to the right of the graph
      let hoverG = this.g.append('g').attr('transform', 'translate(' + (this.size.width + 20) + ',' + (this.size.height / 2) + ')')
      this._hoverText = new HoverText(hoverG)

      let scaleG = this.g.append('g').attr('transform', 'translate(' + (this.size.width + 5) + ',0)')
      this.scale = new PredictionMatrixScale(scaleG, this.size.height)
    }

    // Remove paddin gand clear axes
    this._boundingPadding = new Rectangle(0, 0, 0, 0)
    if (!embedded) {
      this._xAxis.removeTicks()
      this._xAxis.removeLine()
      this._xAxis.gText.text('Steering').attr('y', 15)
      this._yAxis.removeTicks()
      this._yAxis.removeLine()
      this._yAxis.gText.text('Throttle').attr('y', -10)
    } else {
      this.g.selectAll('.axis').remove()
    }

    // Determine bands and bandwidth for each cell
    let xDomain = d3.scaleLinear()
      .domain([0, STEER_ACTIONS])
      .range([0, this.size.width])
    let yDomain = d3.scaleLinear()
      .domain([0, THROTTLE_ACTIONS])
      .range([this.size.height, 0])
    let xBandwidth = xDomain(1)
    let yBandwidth = yDomain(THROTTLE_ACTIONS-1) - yDomain(THROTTLE_ACTIONS)

    // Insert all of the action cells (no data yet)
    for (let idx = 0; idx < NUM_ACTIONS; idx ++) {
      let xVal = xDomain(idx % STEER_ACTIONS)
      let yVal = yDomain(Math.floor(idx / STEER_ACTIONS))

      // Square
      let box = this.addBox(new Rectangle(xVal, yVal + yBandwidth, xVal + xBandwidth, yVal))
      box.g.attr('stroke', 'clear')
      if (!embedded) {
        box.g
          .on('mouseover', (d: any) => {
            if (d != null) {
              this.hoverDisplay(d[0], d[1])
            }
            updateRunLineGradient(idx)
            REWARDS_GRAPH.runLine().g.style('stroke', 'url(#runLineGradient)')
          })
          .on('mouseout', (v: any) => {
            this.stopHover()
            REWARDS_GRAPH.runLine().g.style('stroke', '')
          })
          .on('mousedown', () => {
            this._monoColors = false
            this._updateColors()
          })
          .on('mouseup', () => {
            this._monoColors = true
            this._updateColors()
          })
      }
      this.squares.push(box)
    }
  }

  // Inserts the data into the already generated squares
  data(prediction: Prediction, sample: Sample) {
    this.prediction = prediction
    this.sample = sample
    this._updateColors()
    if (this._header) {
      this._header.text('Sample: ' + sample.name)
    }
    if (this.scale) {
      this.scale.scale(
        prediction.data.reduce(reduceMin, undefined),
        prediction.data.reduce(reduceMax, undefined)
      )
    }
  }

  // Applies colors to the grid depending on mode (prediction or label)
  private _updateColors() {
    let valueMap: {[key: number]: any} = {}
    if (this._monoColors) {
      let map = d3.scaleSequential(d3.interpolateBlues).domain([0, 1])
      valueMap[0] = map
      valueMap[1] = map
      valueMap[2] = map
    } else {
      valueMap[0] = function() { return 'red' }
      valueMap[1] = function() { return 'yellow' }
      valueMap[2] = function() { return 'green' }
    }

    let prediction = this.prediction
    if (prediction != null) {
      prediction.dataNormalized.forEach((v, i) => {
        // let color = colors[sample.labels[i]]
        let datum = [i, prediction.data[i]]
        let label = this.sample.labels[i]
        this.squares[i].g.attr('fill', valueMap[label](v)).datum(datum)
      })
    }
  }

  private hoverDisplay(index: number, value: number) {
    if (this._hoverText) {
      value = Math.round(value * 1000) / 10
      let throttle = THROTTLE_VALUES[Math.floor(index / STEER_ACTIONS)]
      let steering = STEERING_VALUES[index % STEER_ACTIONS]
      this._hoverText.show(value, throttle, steering)
    }
  }

  private stopHover() {
    if (this._hoverText) {
      this._hoverText.hide()
    }
  }

}


// =============================================
// =============================================
// =============================================
// =========== GRADIENTS ===========================
// =============================================
// =============================================
// =============================================


function _build_pred_matrix_scale_defs() {
  let gradient = d3.select('#defs')
      .append('linearGradient')
      .attr('id', 'predMatrixGradient')
      .attr('x1', '0%')
      .attr('y1', '100%')
      .attr('x2', '0%')
      .attr('y2', '0%')
      .attr('spreadMethod', 'pad')

    linspace(0, 100, 10)
      .map(d => Math.round(d))
      .forEach(function(pct, idx) {
        let color = d3.interpolateBlues(pct / 100.0)
        gradient.append('stop')
          .attr('offset', pct + '%')
          .attr('stop-color', color)
          .attr('stop-opacity', 1);
      });
}
_build_pred_matrix_scale_defs()



function updateRunLineGradient(actionIndex: number) {
  // Remove all children
  d3.select('#runLineGradient').selectAll('stop').remove()

  // Determine all of the predictions and the prediction range
  let sampleData = STORED_DATA.map[SELECTED_SAMPLE]
  let predsForRun = sampleData.runs[sampleData.runs.length - 1]
  let predictionValues = predsForRun.predictions.map(preds => preds.data[actionIndex])
  let predMax = predictionValues.reduce(reduceMax, undefined)
  let predMin = predictionValues.reduce(reduceMin, undefined)

  predictionValues.forEach((point, stepIndex) => {
    let pct = stepIndex / predictionValues.length * 100
    let color = d3.interpolateBlues((point - predMin) / predMax)
    RUNLINE_GRADIENT.append('stop')
      .attr('offset', pct + '%')
      .attr('stop-color', color)
      .attr('stop-opacity', 1);
  })
}

var RUNLINE_GRADIENT
function _build_run_line_gradient() {
  RUNLINE_GRADIENT = d3.select('#defs')
    .append('linearGradient')
    .attr('id', 'runLineGradient')
    .attr('x1', '0%')
    .attr('x2', '100%')
    .attr('y1', '0%')
    .attr('y2', '0%')
    .attr('spreadMethod', 'pad')
}
_build_run_line_gradient()

// =============================================
// =============================================
// =============================================
// =========== SETUP ===========================
// =============================================
// =============================================
// =============================================
// Here we'll build all of the graphs and place them on the page.  The data
// is then loaded for the rewards graph and the spectrograms data.  All of
// the update functions are then created, allowing page interactions to
// directly influence the application state.

// State values
let SELECTED_STEPS: number[] = [0]
let SELECTED_SAMPLE: string = ''
let IS_MANUAL_SELECTION: boolean = false
let UPDATE_ON: boolean = false

// Build the components first
let REWARDS_GRAPH = new RewardsGraph()
let SPECTROGRAMS = new SpectrogramsArea()
let MAIN_PREDICTIONS = new PredictionMatrix(d3.select('#predictions'))
let STORED_DATA: SampleDataRepo
let EVENTS: EpisodeEvent[] = []

// Populate the rewards
REWARDS_GRAPH.loadCurveBoxplotData()
  .then(() => {
    fireCurrentUpdateQuery()
  })
  .then(() => {
    createEvent(0, 'Start', new EventMetadata(0.0001, 0.3, 0.01, 0))
    createEvent(1000000, 'Phase 2', new EventMetadata(0.00001, 0.1, 0.001, 1000000))
    createEvent(2000000, 'Phase 3', new EventMetadata(0.000001, 0.05, 0, 2000000))
    REWARDS_GRAPH.deselectEvents()
  })

// Populate the spectrogram area + predictions matrix

function loadSpectrogramData() {
  return DATA.getSampleDataRepo(DATA_COMPRESSION_PREDICTIONS)
    .then(data => {
      // Save the data
      STORED_DATA = data

      // Spectrograms
      SPECTROGRAMS.data(data)
      if (SELECTED_SAMPLE == '') {
        SPECTROGRAMS.spectrogramsMap['Left'].select()
      }
    })
}

function setSelectedSample(sample: string) {
  if (sample == SELECTED_SAMPLE) return
  SELECTED_SAMPLE = sample
  updateSelections()
}

function setSelectedStep(step: number = -1, manual: boolean = true) {
  // Double click?
  let last = REWARDS_GRAPH.lastStep()
  if (step == -1 || step > last) {
    step = last
    manual = false
  }

  // Select
  IS_MANUAL_SELECTION = manual
  SELECTED_STEPS = [step]
  updateSelections()

  setEventInputValue('step', '')
}

function setSelectionRange(step_0: number = -1, step_1: number = -1) {
  // Both -1?
  if (step_0 == step_1 && step_1 == -1) {
    setSelectedStep(-1, false)
    return
  }

  // Set range
  IS_MANUAL_SELECTION = true
  SELECTED_STEPS = [step_0, step_1]
  updateSelections()

  setEventInputValue('step', '')
}

function updateSelections() {
  // Attempt to get the run predictions and the sample from the data
  let runPredictions: PredictionsForRun = null
  let sample: Sample = null
  if (STORED_DATA != null) {
    let sampleData = STORED_DATA.map[SELECTED_SAMPLE]
    if (sampleData != null) {
      runPredictions = sampleData.runs[CURRENT_RUN_ID - 1]
      sample = sampleData.sample
    }
  }

  // Do a single or range selection
  if (SELECTED_STEPS.length == 1) {
    applySingleSelection(runPredictions, sample)
  }
  else {
    applyRangeSelection(runPredictions, sample)
  }
  SPECTROGRAMS.updatePredictions()
}

function applySingleSelection(runPredictions: PredictionsForRun, sample: Sample) {
  // Select the rewards graph
  REWARDS_GRAPH.selectStep(SELECTED_STEPS[0])

  // Select predictions
  if (runPredictions != null) {
    MAIN_PREDICTIONS.data(determineCurrentPrediction(runPredictions), sample)
  }
}

function applyRangeSelection(runPredictions: PredictionsForRun, sample: Sample) {
  // Select the rewards graph
  REWARDS_GRAPH.selectStepRange(SELECTED_STEPS)

  // Prediction range
  let predictions = determineAveragePrediction(runPredictions, sample)
  if (predictions) {
    MAIN_PREDICTIONS.data(predictions, sample)
  }
}

function elementwiseAdd(a: number[], b: number[]) {
  return a.map((value, index) => a[index] + b[index])
}
function elementwiseMult(a: number[], b: number[]) {
  return a.map((value, index) => a[index] * b[index])
}
function elementwiseMultScalar(a: number[], b: number) {
  return a.map(value => value * b)
}

function normalizeNumberArrays(sources: number[][]) {
  return elementwiseMultScalar(
    sources.reduce(
      (prev, curr) => elementwiseAdd(prev, curr),
      sources[0].map(it => 0)
    ),
    (1 / sources.length)
  )
}

function fireCurrentUpdateQuery() {
  loadSpectrogramData()
    .then(() => {
      REWARDS_GRAPH.loadRunLine()
    })
}

function setUpdatesEnabled(enabled: boolean) {
  if (!enabled) {
    UPDATE_ON = false
    d3.select('#stop').text('Start')
  } else {
    UPDATE_ON = true
    d3.select('#stop').text('Stop')
  }
}

function eventInputValue(name: string) {
  let item = document.getElementById(name) as HTMLInputElement
  return parseFloat(item.value)
}
function setEventInputValue(name: string, value: number|string) {
  let item = document.getElementById(name) as HTMLInputElement
  item.value = String(value)
}

function generateEventMetadata(step: number) {
  return new EventMetadata(
    eventInputValue("learning-rate"),
    eventInputValue("exploration-rate"),
    eventInputValue("reward-shift"),
    step
  );
}

function reversePopulateEventMetadata(metadata: EventMetadata) {
  setEventInputValue('learning-rate', metadata.learningRate)
  setEventInputValue('exploration-rate', metadata.explorationRate)
  setEventInputValue('reward-shift', metadata.rewardShift)
  setEventInputValue('step', metadata.step)
}

function createEvent(step: number, name: string = null, metadata: EventMetadata = null) {
  if (name == null) {
    name = 'Event' + (EVENTS.length + 1)
  }
  if (metadata == null) {
    metadata = generateEventMetadata(step)
  }
  let event = new EpisodeEvent(step, name, metadata)
  EVENTS.push(event)
  REWARDS_GRAPH.addEvent(event)
}

function clearEvents() {
  EVENTS = []
  REWARDS_GRAPH.clearEvents()
}

d3.select('#new-episode').on('mousedown', () => {
  setUpdatesEnabled(true)
  clearEvents()
  DATA.resetCurrent()
    .then(() => {
      fireCurrentUpdateQuery()
    })
})

d3.select('#new-event').on('mousedown', () => {
  createEvent(REWARDS_GRAPH.lastStep())
  // createEvent(SELECTED_STEP)
})

setInterval(function() {
  if (UPDATE_ON) {
    fireCurrentUpdateQuery()
  }
}, 1000)
