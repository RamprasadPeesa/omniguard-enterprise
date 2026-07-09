#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OMNI_DIR="$ROOT_DIR/omniguard"
CLI_DIR="$ROOT_DIR/cli"

need() { command -v "$1" >/dev/null 2>&1 || { echo "[OmniGuard] missing $1" >&2; exit 1; }; }
need aws
need docker
need node
need npm

[[ -z "${AWS_ACCOUNT_ID:-}" ]] && { echo "[OmniGuard] AWS_ACCOUNT_ID required" >&2; exit 1; }
[[ -z "${VITE_SUPABASE_URL:-}" ]] && { echo "[OmniGuard] VITE_SUPABASE_URL required" >&2; exit 1; }
[[ -z "${VITE_SUPABASE_ANON_KEY:-}" ]] && { echo "[OmniGuard] VITE_SUPABASE_ANON_KEY required" >&2; exit 1; }

AWS_REGION="${AWS_REGION:-us-east-1}"
ECR_REPO="${ECR_REPO:-omniguard}"
ECS_CLUSTER="${ECS_CLUSTER:-omniguard}"
ECS_SERVICE="${ECS_SERVICE:-omniguard-service}"
IMAGE_TAG="${IMAGE_TAG:-$(date +%Y%m%d%H%M%S)}"
IMAGE_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}:${IMAGE_TAG}"

echo "[OmniGuard] building dashboard"
cd "$OMNI_DIR"
npm install
npm run build

echo "[OmniGuard] building cli"
cd "$CLI_DIR"
npm install
npm pack >/dev/null

echo "[OmniGuard] logging into ECR"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
aws ecr describe-repositories --region "$AWS_REGION" --repository-names "$ECR_REPO" >/dev/null 2>&1 || aws ecr create-repository --region "$AWS_REGION" --repository-name "$ECR_REPO" >/dev/null

echo "[OmniGuard] building container image"
docker build -t "$IMAGE_URI" \
  --build-arg VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
  --build-arg VITE_SUPABASE_ANON_KEY="$VITE_SUPABASE_ANON_KEY" \
  "$OMNI_DIR"
docker push "$IMAGE_URI"

TASK_DEF_FILE="$ROOT_DIR/.omniguard-ecs-task.json"
cat > "$TASK_DEF_FILE" <<JSON
{
  "family": "omniguard",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/OmniGuardECSTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::${AWS_ACCOUNT_ID}:role/OmniGuardECSTaskRole",
  "containerDefinitions": [{
    "name": "omniguard",
    "image": "${IMAGE_URI}",
    "essential": true,
    "portMappings": [{ "containerPort": 80, "protocol": "tcp" }],
    "environment": [
      { "name": "VITE_SUPABASE_URL", "value": "${VITE_SUPABASE_URL}" },
      { "name": "VITE_SUPABASE_ANON_KEY", "value": "${VITE_SUPABASE_ANON_KEY}" }
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/omniguard",
        "awslogs-region": "${AWS_REGION}",
        "awslogs-stream-prefix": "ecs"
      }
    },
    "healthCheck": {
      "command": ["CMD-SHELL", "wget -qO- http://localhost/health || exit 1"],
      "interval": 30,
      "timeout": 5,
      "retries": 3,
      "startPeriod": 20
    }
  }]
}
JSON

echo "[OmniGuard] registering task definition"
TASK_ARN=$(aws ecs register-task-definition --region "$AWS_REGION" --cli-input-json file://"$TASK_DEF_FILE" --query 'taskDefinition.taskDefinitionArn' --output text)
echo "[OmniGuard] task: $TASK_ARN"

aws logs create-log-group --region "$AWS_REGION" --log-group-name /ecs/omniguard >/dev/null 2>&1 || true

if aws ecs describe-services --region "$AWS_REGION" --cluster "$ECS_CLUSTER" --services "$ECS_SERVICE" --query 'services[0].status' --output text 2>/dev/null | grep -q ACTIVE; then
  echo "[OmniGuard] updating ECS service"
  aws ecs update-service --region "$AWS_REGION" --cluster "$ECS_CLUSTER" --service "$ECS_SERVICE" --task-definition "$TASK_ARN" --force-new-deployment >/dev/null
else
  echo "[OmniGuard] ECS service not found. Create the service once using the task definition above, then rerun this script."
fi

echo "[OmniGuard] production deployment steps complete"
echo "[OmniGuard] image: $IMAGE_URI"
echo "[OmniGuard] task definition: $TASK_ARN"
