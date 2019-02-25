# vaml_guided_learning
By Grant Fennessy

## Installation
Install Python3, then install all requirements in the requirements.txt file.

The index.ts file will need to be compiled into javascript, which requires installing `npm install -g typescript
`.  Once installed, run `tsc` to generate the `./www/index.js` file.


### Data folder
Running the server requires maintaining a data folder for all experiments, which is not provided with the installation.  At the moment, the server looks for the `../thesis_data` folder. 

At the moment this folder is populated by way of the `./vaml/data` scripts, which extract step logs from my thesis model trainer and convert them into numpy object files, which can be loaded much faster than json.


## Web Server
Launch the web server with `python3 serve.py` 

Navigate to `http://localhost:5678/` and use the application.

