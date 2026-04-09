import os
import re

def replace_anthropic(filepath):
    with open(filepath, "r") as f:
        content = f.read()

    # Replace import
    content = re.sub(r"import anthropic", "from openai import AsyncOpenAI", content)

    # Replace client init
    content = re.sub(r"client = anthropic\.AsyncAnthropic\(api_key=settings\.anthropic_api_key\)",
                     "client = AsyncOpenAI(api_key=settings.openai_api_key)", content)

    # Replace messages.create
    # It looks like:
    # response = await client.messages.create(
    #     model=settings.llm_premium_model,
    #     max_tokens=...,
    #     system=...,
    #     messages=[{"role": "user", "content": user_prompt}],
    # )
    
    # We can use a regex to capture system prompt and max tokens
    pattern = r"response = await client\.messages\.create\(\s*model=(.*?),\s*max_tokens=(.*?),\s*system=(.*?),\s*messages=\[\{\"role\": \"user\", \"content\": (.*?)\}\],\s*\)"
    
    def replacer(match):
        model = match.group(1)
        max_tokens = match.group(2)
        system = match.group(3)
        user_content = match.group(4)
        
        return f"""response = await client.chat.completions.create(
        model={model},
        max_tokens={max_tokens},
        messages=[
            {{"role": "system", "content": {system}}},
            {{"role": "user", "content": {user_content}}}
        ],
        response_format={{"type": "json_object"}},
    )"""

    content = re.sub(pattern, replacer, content)

    # Replace response parsing
    content = re.sub(r"raw = response\.content\[0\]\.text if response\.content else \"\{\}\"",
                     "raw = response.choices[0].message.content if response.choices else \"{}\"", content)

    with open(filepath, "w") as f:
        f.write(content)

files = [
    "ai-service/workers/narrative.py",
    "ai-service/workers/technical.py",
    "ai-service/workers/sow_maker.py"
]

base_dir = "/home/likhithrajup/.openclaw/workspace/projects/presales-orchestrator"
for file in files:
    replace_anthropic(os.path.join(base_dir, file))

# For scorer.py, we just replace the functions
scorer_path = os.path.join(base_dir, "ai-service/workers/scorer.py")
with open(scorer_path, "r") as f:
    scorer_content = f.read()

scorer_content = re.sub(r"async def _score_with_claude\(prompt: str, settings\) -> dict\[str, dict\]:.*?async def _score_with_gemini",
                        "async def _score_with_claude(prompt: str, settings) -> dict[str, dict]:\n    return await _score_with_openai(prompt, settings)\n\nasync def _score_with_gemini",
                        scorer_content, flags=re.DOTALL)

scorer_content = re.sub(r"async def _score_with_gemini\(prompt: str, settings\) -> dict\[str, dict\]:.*?def _aggregate_scores",
                        "async def _score_with_gemini(prompt: str, settings) -> dict[str, dict]:\n    return await _score_with_openai(prompt, settings)\n\ndef _aggregate_scores",
                        scorer_content, flags=re.DOTALL)

with open(scorer_path, "w") as f:
    f.write(scorer_content)

print("Done")
