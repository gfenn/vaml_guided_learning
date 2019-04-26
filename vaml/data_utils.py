import json
import os
import numpy as np


# Loads the 25, 50, and 75 percentile data for rewards across all runs.
# Then applies compression to keep data size down.
def load_metrics(folder, compression):
    run_ids = load_all_run_ids(folder)[0:-1]
    data = load_all_runs_field_numpy(folder, 'rewards', compression, run_ids)
    percentiles = {
        'p' + str(p): list(np.percentile(data, p, axis=0))
        for p in [25, 50, 75]
    }
    return percentiles


# Loads all of the specified field values within a given run.
def load_run_field(folder, run_id, field, compression):
    # Read files
    reward_data = load_all_episodes_field_numpy(folder, run_id, field)
    if reward_data is None:
        return list()
    compressed = compress_array(reward_data, compression)
    return compressed.tolist()


# Loads all of the predictions being made against the sample
def load_predictions(folder, run_id, sample):
    return np.load('{folder}/run_{run}/predictions_{sample}.npy'.format(
        folder=folder,
        run=run_id,
        sample=sample
    ))


# Compresses the size of a number array by bucketizing values across their mean.
# This is handled by reshaping the array with appropriate padding, using numpy
# to reduce by mean, then re-solving the area that had padding.
def compress_array(steps, compression):
    # Add padding so it is even (will be removed later)
    padding = (-len(steps)) % compression
    padded = steps if padding == 0 else np.concatenate((steps, np.zeros(padding)))

    # Reshape and apply mean on first axis
    reduced = padded.reshape(
        [padded.shape[0]//compression, compression]
    ).mean(1)

    # Padding section
    if padding > 0:
        reduced[-1] = steps[-compression:-padding].mean()
    return reduced



def iterate_episodes(run_metadata):
    for episode_id in range(1, int(run_metadata['episodes']) + 1):
        yield episode_id


#################### DIRECT LOADING OF FILES ####################

def load_all_run_ids(folder):
    run_folders = os.listdir(folder)
    run_ids = list()
    for subfolder in run_folders:
        run_tokens = subfolder.split('_')
        try:
            if len(run_tokens) == 2:
                run_ids.append(int(run_tokens[1]))
        except:
            pass
    run_ids.sort()
    return run_ids

def load_run_field_json(folder, run_id, field):
    filename = '{folder}/run_{run}/run_{run}_{field}.json'.format(
        folder=folder,
        run=run_id,
        field=field
    )
    with open(filename, 'r') as fh:
        return json.load(fh)


def load_all_runs_field_numpy(folder, field, compression, run_ids=None):
    # Ensure run ids loaded
    run_ids = run_ids or load_all_run_ids(folder)

    # Load all data
    data = list()
    shortest_length = 99999999
    for run_id in run_ids:
        item = load_all_episodes_field_numpy(folder, run_id, field)
        if item is not None:
            item = compress_array(item, compression)
            data.append(item)
            shortest_length = min(shortest_length, item.size)

    # Trim each item as needed
    for idx in range(0, len(data)):
        data[idx] = np.reshape(data[idx][0:shortest_length], (1, shortest_length))

    # Convert into a volume of data
    combined = np.concatenate(data, axis=0)
    return combined


def load_episode_field_numpy(folder, run_id, episode_id, field):
    return np.load('{folder}/run_{run}/episode_{ep}_{field}.npy'.format(
        folder=folder,
        run=run_id,
        ep=episode_id,
        field=field
    ))


def load_all_episodes_field_numpy(folder, run_id, field):
    try:
        return np.load('{folder}/run_{run}/run_{run}_{field}.npy'.format(
            folder=folder,
            run=run_id,
            field=field
        ))
    except:
        return None


def load_episode_field_json(folder, run_id, episode_id, field):
    filename = '{folder}/run_{run}/episode_{ep}_{field}.json'.format(
        folder=folder,
        run=run_id,
        ep=episode_id,
        field=field
    )
    with open(filename, 'r') as fh:
        return json.load(fh)
