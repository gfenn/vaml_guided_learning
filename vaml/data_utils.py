import json
import os
import numpy

def load_group_metrics(root_folder, compression):
    # Iterate files
    group = []
    for file in os.listdir(root_folder):
        tokens = file.split('_')
        try:
            data = load_run_steps(root_folder, int(tokens[1]))
            group.append(compress_steps(data, compression))
        except:
            pass


def calculate_step_metrics(group, step):
    percentiles = {
        "p100": group[0][step],
        "p75": group[0][step],
        "p50": group[0][step],
        "p25": group[0][step],
        "p0": group[0][step]
    }
    percentiles.p75 = 9


def load_run_steps(root_folder, run_id):
    # Read files
    run_folder = '{folder}/run_{id}'.format(folder=root_folder, id=run_id)
    with open('{folder}/metadata.json'.format(folder=run_folder)) as fh:
        run_metadata = json.load(fh)
    accumulated_data = list()
    for episode_id in range(1, int(run_metadata['episodes']) + 1):
        with open('{folder}/episode_{episode}.json'.format(folder=run_folder, episode=episode_id)) as fh:
            episode = json.load(fh)
        for step in episode['steps']:
            accumulated_data.append(step['reward'])
    return accumulated_data


def compress_steps(steps, compression):
    reduced = list()
    adder = 0
    counter = 0
    for index in range(len(steps)):
        adder += steps[index]
        counter += 1
        if counter >= compression:
            reduced.append(adder / counter)
            counter = 0
            adder = 0

    # Add last bit of data
    if counter >= compression / 2:
        reduced.append(adder / counter)

    # Return
    return reduced
