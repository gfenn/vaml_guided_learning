import json
import os
from io import StringIO

def jsonize_raw_results(filename):
    # Build the metadata object
    metadata = {'steps': 0, 'reward': 0}

    # Build the list of step data
    step_list = []
    with open(filename, 'r') as fh:
        for line in fh:
            step_json = json.load(StringIO(line.strip()))
            step_list.append(step_json)
            metadata['steps'] += 1
            metadata['reward'] += step_json['reward']

    datas = json.dumps(
        obj={'metadata': metadata, 'steps': step_list},
        sort_keys=True,
        indent=2
    )
    return datas

ROOT_FOLDER = '../data'
OLD_FOLDER = ROOT_FOLDER + '/old'
CONVERTED_FOLDER = ROOT_FOLDER + '/converted'

if __name__ == '__main__':
    # Iterate all files
    for file in os.listdir(OLD_FOLDER):
        old_filename = '{base}/{file}'.format(
            base=OLD_FOLDER,
            file=file
        )
        result = jsonize_raw_results(old_filename)

        converted_filename = '{base}/{file}.json'.format(
            base=CONVERTED_FOLDER,
            file=os.path.splitext(file)[0]
        )
        with open(converted_filename, 'w') as fh:
            fh.write(result)
    pass
