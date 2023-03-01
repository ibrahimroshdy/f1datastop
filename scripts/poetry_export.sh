#!/bin/bash

pyfiglet Poetry Export

# Exports poetry dependencies in the format of requirements.txt
poetry export -f requirements.txt -o requirements.txt --without-hashes
