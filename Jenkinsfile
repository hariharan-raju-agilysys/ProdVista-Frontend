// =============================================================================
// ProdVista Frontend — Jenkins Declarative Pipeline
// =============================================================================
// Organisation : Agilysys-Inc
// Repository   : prodvista-frontend
//
// Stages:
//   1. Checkout
//   2. Install dependencies
//   3. Lint
//   4. Type-check
//   5. Build (Vite)
//   6. Docker build & push to ACR
//   7. (main only) Notify deployment
//
// Required Jenkins credentials:
//   AZURE_ACR_LOGIN_SERVER  — e.g. myregistry.azurecr.io   (Secret Text)
//   AZURE_ACR_USERNAME      — ACR service-principal username (Secret Text)
//   AZURE_ACR_PASSWORD      — ACR service-principal password (Secret Text)
//   VITE_AZURE_CLIENT_ID    — Azure AD app client ID         (Secret Text)
//   VITE_AZURE_TENANT_ID    — Azure AD tenant ID             (Secret Text)
//   VITE_REDIRECT_URI       — OAuth redirect URI             (Secret Text)
// =============================================================================

pipeline {
    agent {
        docker {
            image 'node:20-alpine'
            args  '--user root'
        }
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '10'))
        timeout(time: 30, unit: 'MINUTES')
        disableConcurrentBuilds()
        timestamps()
    }

    environment {
        // ── Application ──────────────────────────────────────────────────────
        IMAGE_NAME          = 'prodvistaui'
        VITE_APP_TITLE      = 'ProdVista Dashboard'
        VITE_API_TIMEOUT    = '30000'
        VITE_ENABLE_DEVTOOLS = 'false'

        // ── Registry (injected from Jenkins credentials) ──────────────────────
        ACR_LOGIN_SERVER    = credentials('AZURE_ACR_LOGIN_SERVER')
        ACR_USERNAME        = credentials('AZURE_ACR_USERNAME')
        ACR_PASSWORD        = credentials('AZURE_ACR_PASSWORD')

        // ── Azure / MSAL build-time vars ──────────────────────────────────────
        VITE_AZURE_CLIENT_ID = credentials('VITE_AZURE_CLIENT_ID')
        VITE_AZURE_TENANT_ID = credentials('VITE_AZURE_TENANT_ID')
        VITE_REDIRECT_URI    = credentials('VITE_REDIRECT_URI')
    }

    stages {
        // ── 1. Checkout ──────────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                checkout scm
                sh 'node --version && npm --version'
            }
        }

        // ── 1b. Version Stamp ────────────────────────────────────────────────
        stage('Version Stamp') {
            steps {
                script {
                    def pkgVersion = sh(script: "node -p \"require('./package.json').version\"", returnStdout: true).trim()
                    env.IMAGE_VERSION = "${pkgVersion}.${BUILD_NUMBER}"
                    currentBuild.displayName = env.IMAGE_VERSION
                }
            }
        }

        // ── 2. Install ───────────────────────────────────────────────────────
        stage('Install Dependencies') {
            steps {
                sh 'npm ci --ignore-scripts'
            }
        }

        // ── 3. Lint ──────────────────────────────────────────────────────────
        stage('Lint') {
            steps {
                sh 'npm run lint'
            }
        }

        // ── 4. Type-check ────────────────────────────────────────────────────
        stage('Type-check') {
            steps {
                sh 'npm run type-check'
            }
        }

        // ── 5. Build (Vite) ──────────────────────────────────────────────────
        stage('Build') {
            steps {
                sh '''
                    VITE_API_URL="" \
                    VITE_API_TIMEOUT="${VITE_API_TIMEOUT}" \
                    VITE_APP_TITLE="${VITE_APP_TITLE}" \
                    VITE_AZURE_CLIENT_ID="${VITE_AZURE_CLIENT_ID}" \
                    VITE_AZURE_TENANT_ID="${VITE_AZURE_TENANT_ID}" \
                    VITE_REDIRECT_URI="${VITE_REDIRECT_URI}" \
                    VITE_ENABLE_DEVTOOLS="${VITE_ENABLE_DEVTOOLS}" \
                    npm run build
                '''
            }
            post {
                success {
                    archiveArtifacts artifacts: 'dist/**', fingerprint: true
                }
            }
        }

        // ── 6. Docker build & push ───────────────────────────────────────────
        stage('Docker Build & Push') {
            when {
                anyOf {
                    branch 'main'
                    branch 'release/*'
                }
            }
            agent {
                // Switch to a Docker-capable agent for the build/push step
                label 'docker'
            }
            steps {
                script {
                    def fullImage = "${ACR_LOGIN_SERVER}/${IMAGE_NAME}"

                    // Login to ACR — single-quote shell string so credentials are
                    // resolved by the shell from env vars, never by Groovy interpolation.
                    sh 'echo "${ACR_PASSWORD}" | docker login "${ACR_LOGIN_SERVER}" --username "${ACR_USERNAME}" --password-stdin'

                    // Build
                    sh """
                        docker build \\
                            --build-arg VITE_API_URL="" \\
                            --build-arg VITE_API_TIMEOUT="\${VITE_API_TIMEOUT}" \\
                            --build-arg VITE_APP_TITLE="\${VITE_APP_TITLE}" \\
                            --build-arg VITE_AZURE_CLIENT_ID="\${VITE_AZURE_CLIENT_ID}" \\
                            --build-arg VITE_AZURE_TENANT_ID="\${VITE_AZURE_TENANT_ID}" \\
                            --build-arg VITE_REDIRECT_URI="\${VITE_REDIRECT_URI}" \\
                            --build-arg VITE_ENABLE_DEVTOOLS="\${VITE_ENABLE_DEVTOOLS}" \\
                            -t "${fullImage}:${env.IMAGE_VERSION}" \\
                            -t "${fullImage}:latest" \\
                            -f Dockerfile .
                    """

                    // Push
                    sh "docker push '${fullImage}:${env.IMAGE_VERSION}'"
                    sh "docker push '${fullImage}:latest'"

                    // Cleanup local images to save disk space
                    sh "docker rmi '${fullImage}:${env.IMAGE_VERSION}' '${fullImage}:latest' || true"
                }
            }
        }

        // ── 7. Deploy to AKS via V1 Promote ─────────────────────────────────
        stage('Deploy') {
            when {
                branch 'main'
            }
            agent {
                label 'docker'
            }
            steps {
                script {
                    build job: 'V1 Promote Images from V1DevACR to Appl-utils',
                        parameters: [
                            string(name: 'IMAGE_NAME', value: "${env.IMAGE_NAME}"),
                            string(name: 'IMAGE_VERSION', value: "${env.IMAGE_VERSION}")
                        ]
                }
            }
        }
    }

    // ── Post-build ───────────────────────────────────────────────────────────
    post {
        always {
            cleanWs()
        }
        success {
            echo "✅ Pipeline succeeded for ${env.BRANCH_NAME} (${env.BUILD_NUMBER})"
        }
        failure {
            echo "❌ Pipeline FAILED for ${env.BRANCH_NAME} (${env.BUILD_NUMBER})"
        }
    }
}
