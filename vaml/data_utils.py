import json
import os
import numpy as np


def load_group_metrics(group_folder, compression):
    data = load_all_runs_field_numpy(group_folder, 'rewards', compression)
    percentiles = {
        'p' + str(p): list(np.percentile(data, p, axis=0))
        for p in [25, 50, 75]
    }
    return percentiles


def load_run_field(group_folder, run_id, field, compression):
    # Read files
    reward_data = load_all_episodes_field_numpy(group_folder, run_id, field)
    compressed = compress_array(reward_data, compression)
    return compressed.tolist()




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

def load_run_field_json(group_folder, run_id, field):
    filename = '{base}/run_{run}/run_{run}_{field}.json'.format(
        base=group_folder,
        run=run_id,
        field=field
    )
    with open(filename, 'r') as fh:
        return json.load(fh)


def load_all_runs_field_numpy(group_folder, field, compression):
    run_folders = os.listdir(group_folder)
    run_ids = list()
    for folder in run_folders:
        run_tokens = folder.split('_')
        if len(run_tokens) == 2:
            run_ids.append(int(run_tokens[1]))
    run_ids.sort()

    # Load all data
    data = list()
    shortest_length = 99999999
    for run_id in run_ids:
        item = load_all_episodes_field_numpy(group_folder, run_id, field)
        item = compress_array(item, compression)
        data.append(item)
        shortest_length = min(shortest_length, item.size)

    # Trim each item as needed
    for idx in range(0, len(data)):
        data[idx] = np.reshape(data[idx][0:shortest_length], (1, shortest_length))

    # Convert into a volume of data
    combined = np.concatenate(data, axis=0)
    return combined



def load_episode_field_numpy(group_folder, run_id, episode_id, field):
    return np.load('{base}/run_{run}/episode_{ep}_{field}.npy'.format(
        base=group_folder,
        run=run_id,
        ep=episode_id,
        field=field
    ))


def load_all_episodes_field_numpy(group_folder, run_id, field):
    return np.load('{base}/run_{run}/run_{run}_{field}.npy'.format(
        base=group_folder,
        run=run_id,
        field=field
    ))


def load_episode_field_json(group_folder, run_id, episode_id, field):
    filename = '{base}/run_{run}/episode_{ep}_{field}.json'.format(
        base=group_folder,
        run=run_id,
        ep=episode_id,
        field=field
    )
    with open(filename, 'r') as fh:
        return json.load(fh)