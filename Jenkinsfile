pipeline {
    agent any

    environment {
        CI = 'true'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Install Node & Playwright deps') {
            steps {
                dir('tests/pumb-registration-tests') {
                    bat 'npm ci'
                    bat 'npx playwright install --with-deps'
                }
            }
        }

        stage('Run Playwright tests') {
            steps {
                dir('tests/pumb-registration-tests') {
                    bat 'npm run test'
                }
            }
            post {
                always {
                    junit 'tests/pumb-registration-tests/test-results/results.xml'
                    archiveArtifacts artifacts: 'tests/pumb-registration-tests/playwright-report/**', fingerprint: true
                }
            }
        }
    }
}