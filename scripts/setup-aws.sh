#!/bin/bash
set -e

BUCKET="bitsign-documents"
REGION="us-east-1"
USER="bitsign-app"

echo "Creating S3 bucket..."
aws s3api create-bucket \
  --bucket "$BUCKET" \
  --region "$REGION"

echo "Blocking public access..."
aws s3api put-public-access-block \
  --bucket "$BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

echo "Adding CORS policy..."
aws s3api put-bucket-cors \
  --bucket "$BUCKET" \
  --cors-configuration '{
    "CORSRules": [{
      "AllowedOrigins": ["https://bitsign.vercel.app", "http://localhost:3000"],
      "AllowedMethods": ["GET", "PUT"],
      "AllowedHeaders": ["*"],
      "MaxAgeSeconds": 3600
    }]
  }'

echo "Creating IAM user..."
aws iam create-user --user-name "$USER"

echo "Creating IAM policy..."
POLICY_ARN=$(aws iam create-policy \
  --policy-name bitsign-s3-policy \
  --policy-document "{
    \"Version\": \"2012-10-17\",
    \"Statement\": [{
      \"Effect\": \"Allow\",
      \"Action\": [\"s3:PutObject\", \"s3:GetObject\", \"s3:DeleteObject\"],
      \"Resource\": \"arn:aws:s3:::$BUCKET/*\"
    }]
  }" \
  --query 'Policy.Arn' --output text)

echo "Attaching policy to user..."
aws iam attach-user-policy \
  --user-name "$USER" \
  --policy-arn "$POLICY_ARN"

echo "Creating access key..."
aws iam create-access-key --user-name "$USER"

echo ""
echo "Done. Copy the AccessKeyId and SecretAccessKey from above."
echo "Bucket: $BUCKET | Region: $REGION"
